import { prisma } from "../auth";
import { authenticate, requireOverlayRole } from "../middleware/authMiddleware";
import { corsHeaders } from "../middleware/cors";
import {
  bingoMiddleIndex,
  normalizeBingoState,
  shuffleBingoFields,
  type BingoState,
} from "../lib/bingo";
import { publishOverlay, revisionHeaders, writeIdOf } from "../services/overlay-query";
import { lockElement } from "../services/locks";

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json" },
  });

interface BingoElementContext {
  elementId: string;
  bingoId: string;
  overlayId: string;
}

type BingoChange = { state: Partial<BingoState> } | { error: Response };

/**
 * Reads the card and writes `change(state)` back under the element's row lock, so a toggle
 * or shuffle always builds on the latest card and two people marking different cells at the
 * same time both keep their mark.
 */
const updateBingo = async (
  { elementId, bingoId }: BingoElementContext,
  change: (state: BingoState) => BingoChange
): Promise<Response | null> =>
  prisma.$transaction(async (tx) => {
    await lockElement(tx, elementId);
    const bingo = await tx.bingo.findUnique({ where: { id: bingoId } });
    if (!bingo) return jsonResponse({ error: "Bingo element not found" }, 404);
    const result = change(
      normalizeBingoState({
        rows: bingo.rows,
        columns: bingo.columns,
        freeMiddle: bingo.freeMiddle,
        fields: bingo.fields,
        checked: bingo.checked,
      })
    );
    if ("error" in result) return result.error;
    await tx.bingo.update({ where: { id: bingoId }, data: result.state });
    return null;
  });

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
      elementId: element.id,
      bingoId: element.bingo.id,
      overlayId: element.overlayId,
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

    try {
      const failure = await updateBingo(resolved.context, (state) =>
        state.fields.some((field) => field.length > 0)
          ? { state: { fields: shuffleBingoFields(state.fields) } }
          : { error: jsonResponse({ error: "Add at least one bingo field before shuffling" }, 400) }
      );
      if (failure) return failure;

      const updatedOverlay = await publishOverlay(server, resolved.context.overlayId, writeIdOf(req));

      return jsonResponse(updatedOverlay, 200, revisionHeaders(updatedOverlay));
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const { index, checked } =
      typeof body === "object" && body !== null
        ? (body as { index?: unknown; checked?: unknown })
        : { index: undefined, checked: undefined };

    if (!Number.isInteger(index)) {
      return jsonResponse({ error: "index is required and must be an integer" }, 400);
    }
    if (checked !== undefined && typeof checked !== "boolean") {
      return jsonResponse({ error: "checked must be a boolean" }, 400);
    }

    const cellIndex = index as number;

    try {
      const failure = await updateBingo(resolved.context, (state) => {
        if (cellIndex < 0 || cellIndex >= state.checked.length) {
          return { error: jsonResponse({ error: "Index out of bounds" }, 400) };
        }
        if (state.freeMiddle && cellIndex === bingoMiddleIndex(state.rows, state.columns)) {
          return { error: jsonResponse({ error: "The free middle cell cannot be toggled" }, 400) };
        }
        const next = [...state.checked];
        // With `checked` the cell ends up the way the caller saw it change, even if someone
        // else marked it a moment earlier; a plain toggle would undo their mark instead.
        next[cellIndex] = checked ?? !next[cellIndex];
        return { state: { checked: next } };
      });
      if (failure) return failure;

      const updatedOverlay = await publishOverlay(server, resolved.context.overlayId, writeIdOf(req));

      return jsonResponse(updatedOverlay, 200, revisionHeaders(updatedOverlay));
    } catch (error) {
      console.error("POST /api/bingo/:elementId/toggle Error:", error);
      return jsonResponse({ error: "Invalid request" }, 400);
    }
  }

  return null;
};
