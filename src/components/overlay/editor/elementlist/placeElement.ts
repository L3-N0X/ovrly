import {
  canvasSize,
  CanvasModeEnum,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  ElementTypeEnum,
  type BaseElementStyle,
  type GroupStyle,
  type OnOverlayChange,
  type PrismaOverlay,
} from "@/lib/types";
import { positionInside } from "@/components/overlay/canvasGeometry";
import type { OnStructureChange } from "./ElementListEditor";
import { applyPlacement, type Placement } from "./tree";

// The x/y an element gets when it is moved into `parentId` (null: the canvas), or null when
// it keeps the ones it has: it stays in its parent, or the new one lays it out anyway.
export const positionForMove = (
  overlay: PrismaOverlay,
  sourceId: string,
  parentId: string | null
) => {
  const source = overlay.elements.find((e) => e.id === sourceId);
  const parent = parentId ? overlay.elements.find((e) => e.id === parentId) : null;
  const placesFreely = parentId
    ? parent?.type === ElementTypeEnum.GROUP
    : overlay.canvasMode === CanvasModeEnum.FREE;
  if (!source || !placesFreely || (source.parentId ?? null) === parentId) return null;

  // Where it is on the editor canvas right now, kept inside the new parent.
  const measured = positionInside(sourceId, parentId);
  if (measured) return measured;

  // Not on screen: its old x/y are kept as long as they lie inside the new parent.
  const style = (source.style || {}) as BaseElementStyle;
  const groupStyle = (parent?.style || {}) as GroupStyle;
  const area = parent
    ? { width: groupStyle.width ?? DEFAULT_GROUP_WIDTH, height: groupStyle.height ?? DEFAULT_GROUP_HEIGHT }
    : canvasSize(overlay);
  const x = style.x ?? 0;
  const y = style.y ?? 0;
  return x >= 0 && y >= 0 && x < area.width && y < area.height ? { x, y } : { x: 0, y: 0 };
};

// Moves an element to `placement` and persists it. `position` becomes its new x/y, for moves
// into a parent that places its children freely: the x/y it had belonged to its old parent,
// and kept as they are they could put it anywhere in the new one, out of sight included.
export const placeElement = (
  overlay: PrismaOverlay,
  sourceId: string,
  placement: Placement,
  position: { x: number; y: number } | null,
  onOverlayChange: OnOverlayChange,
  onStructureChange: OnStructureChange
) => {
  // The style goes first: the structure change below builds on the latest state, so it
  // keeps the new position instead of writing the old one back.
  if (position) {
    onOverlayChange((current) => ({
      ...current,
      elements: current.elements.map((el) =>
        el.id === sourceId
          ? { ...el, style: { ...(el.style || {}), ...position } as BaseElementStyle }
          : el
      ),
    }));
  }

  const newElements = applyPlacement(overlay.elements, sourceId, placement);
  // Sends the complete layout, so a newer move can safely replace an older one that hasn't
  // been sent yet.
  onStructureChange(
    (current) => ({ ...current, elements: applyPlacement(current.elements, sourceId, placement) }),
    "reorder",
    {
      url: "/api/elements/reorder",
      method: "POST",
      body: {
        elements: newElements.map(({ id, position, parentId }) => ({
          id,
          position,
          parentId: parentId ?? null,
        })),
        overlayId: overlay.id,
      },
    }
  );
};
