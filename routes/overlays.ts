import type { Prisma } from "../src/generated/prisma/client";
import { normalizeBingoState } from "../lib/bingo";
import { prisma } from "../auth";
import { authenticate, getOverlayAccess, getSharedOverlayIds } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import { findOverlayWithElements, overlayElementsInclude } from "../services/overlay-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElementSeed = any;

// Someone who can open an overlay, as listed on the home page.
interface OverlayMember {
  name: string;
  image: string | null;
  role: "owner" | "editor" | "global";
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
    if (element.timer) {
      data.timer = {
        create: { duration: element.timer.duration, countDown: element.timer.countDown },
      };
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
    // Only someone who can open the overlay may copy it into their own account.
    const access = await getOverlayAccess(session.user, overlayId);
    const originalOverlay = access ? await findOverlayWithElements(overlayId) : null;

    if (!originalOverlay) {
      return new Response(JSON.stringify({ error: "Overlay not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newOverlay = await createOverlayWithElements(
      {
        name: `Copy of ${originalOverlay.name}`,
        description: originalOverlay.description,
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
      try {
        const body = (await req.json()) as {
          name?: unknown;
          description?: unknown;
          globalStyle?: unknown;
        } | null;
        const { name, description, globalStyle } = body ?? {};
        const dataToUpdate: { name?: string; description?: string | null; globalStyle?: object } =
          {};

        if (typeof name === "string" && name.trim()) {
          dataToUpdate.name = name.trim();
        }
        // An empty string or null clears the description.
        if (description === null || typeof description === "string") {
          dataToUpdate.description = description || null;
        }
        if (globalStyle && typeof globalStyle === "object" && !Array.isArray(globalStyle)) {
          dataToUpdate.globalStyle = globalStyle;
        }

        if (Object.keys(dataToUpdate).length === 0) {
          return new Response(JSON.stringify({ error: "No valid fields to update" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const updatedOverlay = await prisma.overlay.update({
          where: { id: overlayId },
          data: dataToUpdate,
          include: overlayElementsInclude,
        });

        server.publish(`overlay-${overlayId}`, JSON.stringify(updatedOverlay));

        return new Response(JSON.stringify(updatedOverlay), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await prisma.overlay.delete({ where: { id: overlayId } });
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
      const sharedOverlayIds = await getSharedOverlayIds(session.user);
      const overlays = await prisma.overlay.findMany({
        where: {
          OR: [{ userId: session.user.id }, { id: { in: sharedOverlayIds } }],
        },
        include: {
          ...overlayElementsInclude,
          user: { select: { name: true, image: true } },
          editors: {
            select: { editorTwitchName: true, editor: { select: { name: true, image: true } } },
          },
        },
      });

      // Global editors can open every overlay of their owner, so they belong to each one's
      // list of people with access.
      const ownerIds = [...new Set(overlays.map((o) => o.userId))];
      const globalEditors = await prisma.editor.findMany({
        where: { ownerId: { in: ownerIds } },
        select: {
          ownerId: true,
          editorTwitchName: true,
          editor: { select: { name: true, image: true } },
        },
      });

      const withMembers = overlays.map(({ user, editors, ...overlay }) => {
        const members: OverlayMember[] = [{ name: user.name, image: user.image, role: "owner" }];
        const add = (
          entry: { editorTwitchName: string; editor: { name: string; image: string | null } | null },
          role: OverlayMember["role"]
        ) => {
          const name = entry.editor?.name ?? entry.editorTwitchName;
          // Twitch names are case-insensitive; someone listed twice is only shown once.
          if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) return;
          members.push({ name, image: entry.editor?.image ?? null, role });
        };
        editors.forEach((entry) => add(entry, "editor"));
        globalEditors
          .filter((entry) => entry.ownerId === overlay.userId)
          .forEach((entry) => add(entry, "global"));
        return { ...overlay, members };
      });

      return new Response(JSON.stringify(withMembers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      try {
        const { name, description, type, elementName, presetId } = (await req.json()) as {
          name?: string;
          description?: string;
          type?: string;
          elementName?: string;
          presetId?: string;
        };

        // If presetId is provided, create overlay based on preset
        if (presetId) {
          // Load the preset
          const presetsPath = `${process.cwd()}/public/presets/overlay-presets.json`;
          const presetsContent = await Bun.file(presetsPath).text();
          const presets = JSON.parse(presetsContent);

          const selectedPreset = presets.presets.find((p: { id: string }) => p.id === presetId);
          if (!selectedPreset) {
            return new Response(JSON.stringify({ error: "Invalid preset ID" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          if (!name) {
            return new Response(JSON.stringify({ error: "Name is required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const newOverlay = await createOverlayWithElements(
            {
              name,
              description,
              userId: session.user.id,
              globalStyle: selectedPreset.globalStyle || {},
            },
            selectedPreset.elements
          );

          const overlayWithElements = await findOverlayWithElements(newOverlay.id);

          return new Response(JSON.stringify(overlayWithElements), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Otherwise, use the legacy method with a single element
        else if (name && type && elementName) {
          const elementCreateData: {
            name: string;
            type: "TITLE" | "COUNTER" | "CONTAINER";
            style: object;
            title?: { create: { text: string } };
            counter?: { create: { value: number } };
          } = {
            name: elementName,
            type: type as "TITLE" | "COUNTER" | "CONTAINER",
            style: {}, // Initialize with empty style object instead of null
          };

          if (type === "TITLE") {
            elementCreateData.title = { create: { text: "New Title" } };
          } else if (type === "COUNTER") {
            elementCreateData.counter = { create: { value: 0 } };
          } else {
            return new Response(JSON.stringify({ error: "Invalid element type" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          const newOverlay = await prisma.overlay.create({
            data: {
              name,
              description,
              userId: session.user.id,
              globalStyle: {},
              elements: {
                create: [elementCreateData],
              },
            },
            include: overlayElementsInclude,
          });

          return new Response(JSON.stringify(newOverlay), {
            status: 201,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          return new Response(
            JSON.stringify({
              error: "Either presetId or name, type, and elementName are required",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
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
