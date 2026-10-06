import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import {
  bingoMiddleIndex,
  normalizeBingoState,
  shuffleBingoFields,
  type BingoState,
} from "../lib/bingo";
import { publishOverlay } from "../services/overlay-query";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface BingoElementContext {
  bingoId: string;
  overlayId: string;
  state: BingoState;
}

type BingoElementResult = { context: BingoElementContext; error?: never } | { error: Response };

/**
 * Loads a bingo element on behalf of the current user, who needs to be able to control
 * the overlay: marking and shuffling cells is part of running it live.
 *
 * Missing elements and elements owned by somebody else both answer 404 so the
 * endpoint cannot be used to discover which element IDs exist.
 */
const resolveBingoElement = async (
  req: Request,
  elementId: string
): Promise<BingoElementResult> => {
  const session = await authenticate(req);
  if (!session) {
    return { error: jsonResponse({ error: "Unauthorized" }, 401) };
  }

  const element = await prisma.element.findUnique({
    where: { id: elementId },
    include: { bingo: true },
  });

  if (!element || !element.bingo) {
    return { error: jsonResponse({ error: "Bingo element not found" }, 404) };
  }

  const check = await requireOverlayRole(
    session.user,
    element.overlayId,
    "CONTROLLER",
    "Bingo element not found"
  );
  if (check.error) {
    return { error: check.error };
  }

  return {
    context: {
      bingoId: element.bingo.id,
      overlayId: element.overlayId,
      state: normalizeBingoState({
        size: element.bingo.size,
        freeMiddle: element.bingo.freeMiddle,
        fields: element.bingo.fields,
        checked: element.bingo.checked,
      }),
    },
  };
};

export const handleBingoRoutes = async (
  req: Request,
  server: { publish: (channel: string, message: string) => unknown | Promise<unknown> },
  path: string
) => {
  const shuffleMatch = path.match(/^\/api\/bingo\/([a-zA-Z0-9_-]+)\/shuffle$/);
  if (shuffleMatch) {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const resolved = await resolveBingoElement(req, shuffleMatch[1]);
    if (resolved.error) {
      return resolved.error;
    }

    const { bingoId, overlayId, state } = resolved.context;

    if (!state.fields.some((field) => field.length > 0)) {
      return jsonResponse({ error: "Add at least one bingo field before shuffling" }, 400);
    }

    try {
      const fields = shuffleBingoFields(state.fields);

      await prisma.bingo.update({
        where: { id: bingoId },
        data: { fields },
      });

      const updatedOverlay = await publishOverlay(server, overlayId);

      return jsonResponse(updatedOverlay);
    } catch (error) {
      console.error("POST /api/bingo/:elementId/shuffle Error:", error);
      return jsonResponse({ error: "Invalid request" }, 400);
    }
  }

  const toggleMatch = path.match(/^\/api\/bingo\/([a-zA-Z0-9_-]+)\/toggle$/);
  if (toggleMatch) {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const resolved = await resolveBingoElement(req, toggleMatch[1]);
    if (resolved.error) {
      return resolved.error;
    }

    const { bingoId, overlayId, state } = resolved.context;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const index =
      typeof body === "object" && body !== null ? (body as { index?: unknown }).index : undefined;

    if (!Number.isInteger(index)) {
      return jsonResponse({ error: "index is required and must be an integer" }, 400);
    }

    const cellIndex = index as number;
    if (cellIndex < 0 || cellIndex >= state.checked.length) {
      return jsonResponse({ error: "Index out of bounds" }, 400);
    }

    if (state.freeMiddle && cellIndex === bingoMiddleIndex(state.size)) {
      return jsonResponse({ error: "The free middle cell cannot be toggled" }, 400);
    }

    try {
      const checked = [...state.checked];
      checked[cellIndex] = !checked[cellIndex];

      await prisma.bingo.update({
        where: { id: bingoId },
        data: { checked },
      });

      const updatedOverlay = await publishOverlay(server, overlayId);

      return jsonResponse(updatedOverlay);
    } catch (error) {
      console.error("POST /api/bingo/:elementId/toggle Error:", error);
      return jsonResponse({ error: "Invalid request" }, 400);
    }
  }

  return null;
};
