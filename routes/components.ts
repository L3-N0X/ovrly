import { randomBytes } from "node:crypto";
import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { corsHeaders, json } from "../middleware/cors";
import { overlayElementsInclude } from "../services/overlay-query";
import { adoptComponentImages, makeTwitchBindingsPortable } from "../services/components";
import {
  COMPONENT_FORMAT,
  COMPONENT_FORMAT_VERSION,
  MAX_COMPONENT_BYTES,
  parseComponentDescription,
  parseComponentElements,
  parseComponentName,
} from "../lib/components";
import { toElementTree, type ElementSeed } from "./overlays";
import type { Prisma } from "../src/generated/prisma/client";

// A user's components: saved from an element of an overlay they edit, imported from a
// component file someone exported, or added from a share link. Only their owner sees them,
// unless they share one by link; adding one to an overlay is
// POST /api/overlays/:id/elements/component (routes/elements.ts).

const IMPORTED_COMPONENT_NAME = "Imported component";

// 144 random bits, URL safe: the link is all it takes to see a shared component.
const newShareToken = () => randomBytes(18).toString("base64url");

const findOwnComponent = (userId: string, id: string) =>
  prisma.component.findFirst({ where: { id, userId } });

const findInTree = (nodes: ElementSeed[], id: string): ElementSeed | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findInTree(node.children, id);
    if (found) return found;
  }
  return null;
};

export const handleComponentsRoutes = async (req: Request, path: string) => {
  if (!path.startsWith("/api/components")) return null;
  const session = await authenticate(req);

  // A component shared by link: anyone with it may look, signed in or not.
  const sharedMatch = path.match(/^\/api\/components\/shared\/([a-zA-Z0-9_-]+)$/);
  if (sharedMatch && req.method === "GET") {
    const component = await prisma.component.findUnique({
      where: { shareToken: sharedMatch[1] },
      include: { user: { select: { name: true, image: true } } },
    });
    if (!component) return json({ error: "This link doesn't work anymore" }, 404);
    return json({
      name: component.name,
      description: component.description,
      elements: component.elements,
      updatedAt: component.updatedAt,
      owner: component.user,
      own: component.userId === session?.user.id,
    });
  }

  if (!session) return json({ error: "Unauthorized" }, 401);
  const userId = session.user.id;

  // Adds a copy of a component shared by link to the user's own.
  if (sharedMatch && req.method === "POST") {
    const shared = await prisma.component.findUnique({ where: { shareToken: sharedMatch[1] } });
    if (!shared) return json({ error: "This link doesn't work anymore" }, 404);
    if (shared.userId === userId) return json({ error: "This is one of your components already" }, 400);
    const elements = parseComponentElements(shared.elements);
    if (typeof elements === "string") return json({ error: elements }, 400);
    // Links are kept like when saving: its owner chose them in an overlay they edit.
    const droppedImages = await adoptComponentImages(elements, userId, { keepLinks: true });
    const component = await prisma.component.create({
      data: {
        userId,
        name: shared.name,
        description: shared.description,
        elements: elements as unknown as Prisma.InputJsonValue,
      },
    });
    return json({ ...component, droppedImages }, 201);
  }

  if (path === "/api/components" && req.method === "GET") {
    const components = await prisma.component.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return json(components);
  }

  // Saves an element, with everything nested in it, as a component.
  if (path === "/api/components" && req.method === "POST") {
    try {
      const { overlayId, elementId, name, description } = (await req.json()) as Record<string, unknown>;
      if (typeof overlayId !== "string" || typeof elementId !== "string") {
        return json({ error: "An overlay and an element are required" }, 400);
      }
      if (name !== undefined && !parseComponentName(name)) {
        return json({ error: "The name must be 1 to 100 characters" }, 400);
      }
      if (description !== undefined && parseComponentDescription(description) === undefined) {
        return json({ error: "The description can be at most 500 characters" }, 400);
      }
      // Saving takes the design along, like copying does, so it needs an editor.
      const check = await requireOverlayRole(session.user, overlayId, "EDITOR");
      if (check.error) return check.error;
      const overlay = await prisma.overlay.findUnique({
        where: { id: overlayId },
        include: overlayElementsInclude,
      });
      const element = overlay && findInTree(toElementTree(overlay.elements), elementId);
      if (!overlay || !element) return json({ error: "Element not found" }, 404);

      const elements = parseComponentElements([element]);
      if (typeof elements === "string") return json({ error: elements }, 400);
      await makeTwitchBindingsPortable(elements, overlay.userId);
      const droppedImages = await adoptComponentImages(elements, userId, { keepLinks: true });

      const component = await prisma.component.create({
        data: {
          userId,
          name: parseComponentName(name) ?? elements[0].name,
          description: parseComponentDescription(description) ?? null,
          elements: elements as unknown as Prisma.InputJsonValue,
        },
      });
      return json({ ...component, droppedImages }, 201);
    } catch (e) {
      console.error(e);
      return json({ error: "Invalid request body" }, 400);
    }
  }

  // Adds a component from a file exported by someone (or the user themselves).
  if (path === "/api/components/import" && req.method === "POST") {
    try {
      const text = await req.text();
      if (text.length > MAX_COMPONENT_BYTES * 2) return json({ error: "This file is too big" }, 413);
      let file: Record<string, unknown>;
      try {
        file = JSON.parse(text);
      } catch {
        return json({ error: "This file isn't valid JSON" }, 400);
      }
      if (!file || typeof file !== "object" || file.format !== COMPONENT_FORMAT) {
        return json({ error: "This isn't an ovrly component file" }, 400);
      }
      if (typeof file.version !== "number" || file.version > COMPONENT_FORMAT_VERSION) {
        return json({ error: "This component was made with a newer version of ovrly" }, 400);
      }
      const elements = parseComponentElements(file.elements);
      if (typeof elements === "string") return json({ error: elements }, 400);
      // Bindings stay as they are: by name, they show this account's variables of those names.
      const droppedImages = await adoptComponentImages(elements, userId, { keepLinks: false });

      const description = parseComponentDescription(file.description);
      const component = await prisma.component.create({
        data: {
          userId,
          name: parseComponentName(file.name) ?? IMPORTED_COMPONENT_NAME,
          description: description ?? null,
          elements: elements as unknown as Prisma.InputJsonValue,
        },
      });
      return json({ ...component, droppedImages }, 201);
    } catch (e) {
      console.error(e);
      return json({ error: "Invalid request body" }, 400);
    }
  }

  const idMatch = path.match(/^\/api\/components\/([a-zA-Z0-9_-]+)$/);
  if (idMatch && req.method === "PATCH") {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      const data: Prisma.ComponentUpdateInput = {};
      if (body.name !== undefined) {
        const name = parseComponentName(body.name);
        if (!name) return json({ error: "The name must be 1 to 100 characters" }, 400);
        data.name = name;
      }
      if (body.description !== undefined) {
        const description = parseComponentDescription(body.description);
        if (description === undefined) {
          return json({ error: "The description can be at most 500 characters" }, 400);
        }
        data.description = description;
      }
      if (!(await findOwnComponent(userId, idMatch[1]))) {
        return json({ error: "Component not found" }, 404);
      }
      return json(await prisma.component.update({ where: { id: idMatch[1] }, data }));
    } catch (e) {
      console.error(e);
      return json({ error: "Invalid request body" }, 400);
    }
  }

  // Shares a component by link (keeping the link it has), or stops sharing it: the link stops
  // working, and sharing again makes a new one. Copies already added stay.
  const shareMatch = path.match(/^\/api\/components\/([a-zA-Z0-9_-]+)\/share$/);
  if (shareMatch && (req.method === "POST" || req.method === "DELETE")) {
    const component = await findOwnComponent(userId, shareMatch[1]);
    if (!component) return json({ error: "Component not found" }, 404);
    if (req.method === "POST" && component.shareToken) return json(component);
    return json(
      await prisma.component.update({
        where: { id: component.id },
        data: { shareToken: req.method === "POST" ? newShareToken() : null },
      })
    );
  }

  if (idMatch && req.method === "DELETE") {
    // Its images stay in the user's files; they may be used in overlays by now.
    const { count } = await prisma.component.deleteMany({ where: { id: idMatch[1], userId } });
    if (count === 0) return json({ error: "Component not found" }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  return json({ error: "Not found" }, 404);
};
