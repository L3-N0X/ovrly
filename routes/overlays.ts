import type { Prisma } from "../src/generated/prisma/client";
import { normalizeBingoState } from "../lib/bingo";
import { prisma } from "../auth";
import {
  authenticate,
  forbiddenMessage,
  getOverlayAccess,
  getSharedOverlayRoles,
  requireOverlayRole,
} from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { hasRole, higherRole, personKey, type AccessRole } from "../lib/sharing";
import {
  findOverlayWithElements,
  overlayElementsInclude,
  publishOverlay,
  revisionHeaders,
  writeIdOf,
} from "../services/overlay-query";
import { lockOverlay } from "../services/locks";
import { isStyleObject, mergeStyle } from "../lib/style";
import { countdownSeed } from "../lib/countdown";
import { iconSeed } from "../lib/icons";
import { twitchStatSeed } from "../lib/twitchStats";
import { variableBindingSeed } from "../lib/variables";
import { fillOverlayBindings } from "../services/variables";
import { nextDefaultName, UNTITLED_OVERLAY_NAME } from "../lib/naming";

// The canvas size bounds, shared with the editor so both clamp the same values.
const MIN_CANVAS_SIZE = 16;
const MAX_CANVAS_SIZE = 7680;

type CanvasMode = "AUTO" | "FREE";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementSeed = any;

// Someone who can open an overlay, as listed on the home page.
interface OverlayMember {
  name: string;
  image: string | null;
  role: AccessRole;
  // Invited by Twitch name, but hasn't signed in to ovrly yet.
  pending: boolean;
}

// Builds the nested create input for a sibling list. Children are created through Prisma's
// nested writes, so each root element and its whole subtree go in with a single statement.
function buildElementCreates(overlayId: string, elements: ElementSeed[]) {
  let position = 0;
  return elements.map((element): Prisma.ElementUncheckedCreateWithoutParentInput => {
    const data: Prisma.ElementUncheckedCreateWithoutParentInput = {
      overlayId,
      name: element.name,
      type: element.type,
      style: element.style || {},
      position: element.position ?? position++,
    };

    if (element.title) {
      data.title = { create: { text: element.title.text } };
    }
    if (element.counter) {
      data.counter = { create: { value: element.counter.value } };
    }
    // Timers and countdowns start out stopped; only a countdown's settings are copied.
    if (element.type === "TIMER") {
      data.timer = { create: {} };
    }
    if (element.type === "COUNTDOWN") {
      data.countdown = { create: countdownSeed(element.countdown) };
    }
    // The value is fetched again for the copy, once it is opened.
    if (element.type === "TWITCH_STAT") {
      data.twitchStat = { create: twitchStatSeed(element.twitchStat) };
    }
    // Only which variable it shows; the value is the new owner's (filled in below).
    if (element.type === "VARIABLE") {
      data.variable = { create: variableBindingSeed(element.variable) };
    }
    if (element.type === "ICON") {
      data.icon = { create: iconSeed(element.icon) };
    }
    if (element.image) {
      data.image = { create: { src: element.image.src } };
    }
    if (element.bingo || element.type === "BINGO") {
      // Presets and duplicates are user supplied data, so the bingo payload is
      // normalised instead of being copied verbatim into the database.
      data.bingo = { create: normalizeBingoState(element.bingo) };
    }
    if (element.children && element.children.length > 0) {
      data.children = { create: buildElementCreates(overlayId, element.children) };
    }
    return data;
  });
}

// Creates the overlay and its element tree atomically: if any element fails to insert, the
// overlay is rolled back too instead of being left behind empty or half-populated.
async function createOverlayWithElements(
  data: Prisma.OverlayUncheckedCreateInput,
  elements: ElementSeed[]
) {
  return prisma.$transaction(async (tx) => {
    const overlay = await tx.overlay.create({ data });
    for (const element of buildElementCreates(overlay.id, elements)) {
      await tx.element.create({ data: element });
    }
    await fillOverlayBindings(tx, overlay.id, overlay.userId);
    return overlay;
  });
}

// Turns the flat element list of an overlay back into a tree of seeds, whatever its depth.
function toElementTree<T extends { id: string; parentId: string | null; position: number | null }>(
  elements: T[]
): ElementSeed[] {
  const ids = new Set(elements.map((e) => e.id));
  const byParent = new Map<string | null, T[]>();
  for (const element of elements) {
    // Orphans (parent missing from the list) are kept as roots instead of being dropped.
    const parentId = element.parentId && ids.has(element.parentId) ? element.parentId : null;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), element]);
  }
  const build = (parentId: string | null): ElementSeed[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((element, index) => ({ ...element, position: index, children: build(element.id) }));
  return build(null);
}

interface OverlayPreset {
  id: string;
  name: string;
  globalStyle?: Prisma.InputJsonValue;
  elements?: ElementSeed[];
  width?: unknown;
  height?: unknown;
  canvasMode?: unknown;
}

const loadPresets = async (): Promise<OverlayPreset[]> => {
  const presetsPath = `${process.cwd()}/public/presets/overlay-presets.json`;
  const { presets } = JSON.parse(await Bun.file(presetsPath).text()) as {
    presets: OverlayPreset[];
  };
  return presets;
};

// The canvas size and placement a preset asks for, when it asks for a valid one.
function presetCanvas(preset: {
  width?: unknown;
  height?: unknown;
  canvasMode?: unknown;
}): Pick<Prisma.OverlayUncheckedCreateInput, "width" | "height" | "canvasMode"> {
  const size = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)))
      : undefined;
  const width = size(preset.width);
  const height = size(preset.height);
  const canvasMode: CanvasMode | undefined =
    preset.canvasMode === "AUTO" || preset.canvasMode === "FREE" ? preset.canvasMode : undefined;
  return {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(canvasMode ? { canvasMode } : {}),
  };
}

export const handleOverlaysRoutes = async (
  req: Request,
  server: { publish: (channel: string, message: string) => unknown | Promise<unknown> },
  path: string
) => {
  const duplicateMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)\/duplicate$/);
  if (duplicateMatch && req.method === "POST") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overlayId = duplicateMatch[1];
    // Copying an overlay takes its whole design along, so it's reserved for editors.
    const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
    if (check.error) return check.error;
    const originalOverlay = await findOverlayWithElements(overlayId);

    if (!originalOverlay) {
      return json({ error: "Overlay not found" }, 404);
    }

    const newOverlay = await createOverlayWithElements(
      {
        name: `Copy of ${originalOverlay.name}`,
        description: originalOverlay.description,
        width: originalOverlay.width,
        height: originalOverlay.height,
        canvasMode: originalOverlay.canvasMode,
        userId: session.user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        globalStyle: originalOverlay.globalStyle as any,
      },
      toElementTree(originalOverlay.elements)
    );

    const overlayWithElements = await findOverlayWithElements(newOverlay.id);

    return new Response(JSON.stringify(overlayWithElements), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const overlayIdMatch = path.match(/^\/api\/overlays\/([a-zA-Z0-9_-]+)$/);
  if (overlayIdMatch) {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const overlayId = overlayIdMatch[1];
    const access = await getOverlayAccess(session.user, overlayId);
    if (!access) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const overlay = await findOverlayWithElements(overlayId);
      return new Response(JSON.stringify(overlay), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      if (!hasRole(access.role, "EDITOR")) {
        return json({ error: forbiddenMessage("EDITOR"), requiredRole: "EDITOR" }, 403);
      }
      try {
        const body = (await req.json()) as {
          name?: unknown;
          description?: unknown;
          globalStyle?: unknown;
          width?: unknown;
          height?: unknown;
          canvasMode?: unknown;
        } | null;
        const { name, description, globalStyle, width, height, canvasMode } = body ?? {};
        const dataToUpdate: {
          name?: string;
          description?: string | null;
          globalStyle?: object;
          width?: number;
          height?: number;
          canvasMode?: CanvasMode;
        } = {};

        if (typeof name === "string" && name.trim()) {
          dataToUpdate.name = name.trim();
        }
        // An empty string or null clears the description.
        if (description === null || typeof description === "string") {
          dataToUpdate.description = description || null;
        }
        // The canvas size OBS is set to. Bounded so a bad value can't produce an overlay
        // nothing can be placed in.
        for (const [key, value] of [
          ["width", width],
          ["height", height],
        ] as const) {
          if (typeof value === "number" && Number.isFinite(value)) {
            dataToUpdate[key] = Math.min(MAX_CANVAS_SIZE, Math.max(MIN_CANVAS_SIZE, Math.round(value)));
          }
        }
        if (canvasMode === "AUTO" || canvasMode === "FREE") {
          dataToUpdate.canvasMode = canvasMode;
        }
        const globalStylePatch = isStyleObject(globalStyle) ? globalStyle : null;

        if (Object.keys(dataToUpdate).length === 0 && !globalStylePatch) {
          return new Response(JSON.stringify({ error: "No valid fields to update" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await prisma.$transaction(async (tx) => {
          // `globalStyle` is a patch (see mergeStyle), merged into the stored style under the
          // overlay's lock so concurrent changes to different properties are all kept.
          if (globalStylePatch) {
            await lockOverlay(tx, overlayId);
            const current = await tx.overlay.findUnique({
              where: { id: overlayId },
              select: { globalStyle: true },
            });
            dataToUpdate.globalStyle = mergeStyle(current?.globalStyle, globalStylePatch);
          }
          await tx.overlay.update({ where: { id: overlayId }, data: dataToUpdate });
        });

        const updatedOverlay = await publishOverlay(server, overlayId, writeIdOf(req));

        return new Response(JSON.stringify(updatedOverlay), {
          headers: {
            ...corsHeaders,
            ...revisionHeaders(updatedOverlay),
            "Content-Type": "application/json",
          },
        });
      } catch (e) {
        console.error("PATCH /api/overlays/:id Error:", e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (req.method === "DELETE") {
      // Editors may change an overlay, but only its owner may delete it.
      if (!access.isOwner) {
        return json({ error: forbiddenMessage("OWNER"), requiredRole: "OWNER" }, 403);
      }
      await prisma.overlay.delete({ where: { id: overlayId } });
      // Others who have it open would otherwise keep editing an overlay that's gone.
      server.publish(`overlay-${overlayId}`, JSON.stringify({ type: "deleted" }));
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle GET /api/overlays (list all user overlays)
  if (path === "/api/overlays") {
    const session = await authenticate(req);
    if (!session) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      const sharedRoles = await getSharedOverlayRoles(session.user);
      const overlays = await prisma.overlay.findMany({
        where: {
          OR: [{ userId: session.user.id }, { id: { in: [...sharedRoles.keys()] } }],
        },
        include: {
          ...overlayElementsInclude,
          user: { select: { name: true, image: true } },
          shares: {
            select: { twitchName: true, role: true, user: { select: { name: true, image: true } } },
          },
        },
      });

      // Account shares reach every overlay of their owner, so they belong to each one's list
      // of people with access.
      const ownerIds = [...new Set(overlays.map((o) => o.userId))];
      const accountShares = await prisma.accountShare.findMany({
        where: { ownerId: { in: ownerIds } },
        select: {
          ownerId: true,
          twitchName: true,
          role: true,
          user: { select: { name: true, image: true } },
        },
      });

      const withMembers = overlays.map(({ user, shares, ...overlay }) => {
        const owner: OverlayMember = {
          name: user.name,
          image: user.image,
          role: "OWNER",
          pending: false,
        };
        const members = new Map<string, OverlayMember>([[personKey(user.name), owner]]);
        const add = (share: (typeof shares)[number]) => {
          const name = share.user?.name ?? share.twitchName;
          const existing = members.get(personKey(name));
          // Someone shared twice (directly and through the account) is listed once, with the
          // role that allows more.
          if (existing) {
            existing.role = higherRole(existing.role, share.role);
            return;
          }
          members.set(personKey(name), {
            name,
            image: share.user?.image ?? null,
            role: share.role,
            pending: !share.user,
          });
        };
        shares.forEach(add);
        accountShares.filter((share) => share.ownerId === overlay.userId).forEach(add);

        const myRole: AccessRole =
          overlay.userId === session.user.id ? "OWNER" : sharedRoles.get(overlay.id)!;
        return { ...overlay, members: [...members.values()], myRole };
      });

      return json(withMembers);
    }

    if (req.method === "POST") {
      try {
        const { name, description, presetId } = (await req.json()) as {
          name?: unknown;
          description?: unknown;
          presetId?: unknown;
        };

        // A template to start from. Without one, the overlay starts as an empty canvas.
        let preset: OverlayPreset | null = null;
        if (presetId !== undefined) {
          const presets = await loadPresets();
          preset = presets.find((p) => p.id === presetId) ?? null;
          if (!preset) return json({ error: "Invalid preset ID" }, 400);
        }

        // Nobody knows what to call an overlay before building it, so the name is optional:
        // it defaults to the template's name (or "Untitled"), numbered like Figma does when
        // one of that name already exists.
        let overlayName = typeof name === "string" ? name.trim() : "";
        if (!overlayName) {
          const own = await prisma.overlay.findMany({
            where: { userId: session.user.id },
            select: { name: true },
          });
          overlayName = nextDefaultName(
            preset?.name ?? UNTITLED_OVERLAY_NAME,
            own.map((o) => o.name)
          );
        }

        // A preset may bring its own canvas size and placement; anything it leaves out
        // falls back to the column defaults (1920x1080, free placement).
        const newOverlay = await createOverlayWithElements(
          {
            name: overlayName,
            description:
              typeof description === "string" && description.trim() ? description.trim() : null,
            userId: session.user.id,
            globalStyle: preset?.globalStyle || {},
            ...(preset ? presetCanvas(preset) : {}),
          },
          preset?.elements ?? []
        );

        const overlayWithElements = await findOverlayWithElements(newOverlay.id);
        return json(overlayWithElements, 201);
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return null; // Return null if route doesn't match
};
