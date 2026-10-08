import {
  CanvasModeEnum,
  ElementTypeEnum,
  isParentType,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";

// Where a dragged element ends up: inside `parentId` (null = top level) at `index`.
export interface Placement {
  parentId: string | null;
  index: number;
}

// What the element is dropped on: before/after a row, onto a parent row, or into the end of
// a list (an empty container's placeholder or the space below the top level list).
export type DropTarget =
  | { kind: "reorder-before" | "reorder-after" | "combine"; id: string }
  | { kind: "append"; parentId: string | null };

export interface FlatRow {
  element: PrismaElement;
  depth: number;
  hasChildren: boolean;
}

const byPosition = (a: PrismaElement, b: PrismaElement) => (a.position ?? 0) - (b.position ?? 0);

export const childrenOf = (elements: PrismaElement[], parentId: string | null) =>
  elements.filter((e) => (e.parentId ?? null) === parentId).sort(byPosition);

// The visible rows of the tree in display order, skipping the children of collapsed parents.
export const flattenTree = (elements: PrismaElement[], collapsed: Set<string>): FlatRow[] => {
  const rows: FlatRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const element of childrenOf(elements, parentId)) {
      const hasChildren = elements.some((e) => e.parentId === element.id);
      rows.push({ element, depth, hasChildren });
      if (isParentType(element.type) && !collapsed.has(element.id)) walk(element.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
};

// Whether the element is placed by its own x/y: it either sits directly inside a group, or it
// sits directly on a canvas that places its elements freely. Those are the two groups it can
// be positioned against, and the canvas can't be removed, so nothing is ever unplaced.
export const isPlacedFreely = (overlay: PrismaOverlay, element: PrismaElement) =>
  overlay.elements.find((e) => e.id === element.parentId)?.type === ElementTypeEnum.GROUP ||
  (!element.parentId && overlay.canvasMode === CanvasModeEnum.FREE);

// True if `id` is `ancestorId` or lies anywhere inside its subtree.
export const isInSubtree = (elements: PrismaElement[], id: string | null, ancestorId: string) => {
  for (let current = id; current; current = elements.find((e) => e.id === current)?.parentId ?? null) {
    if (current === ancestorId) return true;
  }
  return false;
};

// The element followed by everything nested inside it.
export const subtreeOf = (elements: PrismaElement[], id: string): PrismaElement[] => {
  const element = elements.find((e) => e.id === id);
  if (!element) return [];
  return [element, ...elements.filter((e) => e.parentId === id).flatMap((e) => subtreeOf(elements, e.id))];
};

export const resolveDrop = (
  elements: PrismaElement[],
  sourceId: string,
  target: DropTarget
): Placement | null => {
  let placement: Placement;
  if (target.kind === "append") {
    const parentId = target.parentId;
    placement = { parentId, index: childrenOf(elements, parentId).filter((e) => e.id !== sourceId).length };
  } else {
    if (target.id === sourceId) return null;
    const targetElement = elements.find((e) => e.id === target.id);
    if (!targetElement) return null;
    if (target.kind === "combine") {
      if (!isParentType(targetElement.type)) return null;
      const parentId = targetElement.id;
      placement = {
        parentId,
        index: childrenOf(elements, parentId).filter((e) => e.id !== sourceId).length,
      };
    } else {
      const parentId = targetElement.parentId ?? null;
      const siblings = childrenOf(elements, parentId).filter((e) => e.id !== sourceId);
      const targetIndex = siblings.findIndex((e) => e.id === target.id);
      placement = { parentId, index: targetIndex + (target.kind === "reorder-after" ? 1 : 0) };
    }
  }
  // Never move an element into its own subtree; the server would reject it anyway.
  if (placement.parentId && isInSubtree(elements, placement.parentId, sourceId)) return null;
  return placement;
};

// Whether the placement would leave the element exactly where it already is.
export const isCurrentPlacement = (
  elements: PrismaElement[],
  sourceId: string,
  placement: Placement
) => {
  const source = elements.find((e) => e.id === sourceId);
  if (!source || (source.parentId ?? null) !== placement.parentId) return false;
  return childrenOf(elements, placement.parentId).findIndex((e) => e.id === sourceId) === placement.index;
};

// Moves the element and renumbers both affected sibling lists. Returns copies of every element.
export const applyPlacement = (
  elements: PrismaElement[],
  sourceId: string,
  placement: Placement
): PrismaElement[] => {
  const next = elements.map((e) => ({ ...e }));
  const source = next.find((e) => e.id === sourceId);
  if (!source) return next;
  const oldParentId = source.parentId ?? null;

  const targetList = childrenOf(next, placement.parentId).filter((e) => e.id !== sourceId);
  targetList.splice(placement.index, 0, source);
  source.parentId = placement.parentId;
  targetList.forEach((e, index) => (e.position = index));

  if (oldParentId !== placement.parentId) {
    childrenOf(next, oldParentId).forEach((e, index) => (e.position = index));
  }
  return next;
};
