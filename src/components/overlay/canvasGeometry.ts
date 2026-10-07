// Helpers shared by the free-placed element wrapper, the group that contains it and the
// editor's drag and drop on the canvas.
import { CANVAS_ELEMENT_ATTRIBUTE } from "./canvasSelection";

// Holding Shift snaps to a 10px grid.
export const snap = (value: number, shiftKey: boolean) =>
  shiftKey ? Math.round(value / 10) * 10 : Math.round(value);

// The canvas is scaled to fit the editor viewport, so pointer movement on screen has to be
// converted back into canvas pixels.
export const canvasScale = (el: HTMLElement) =>
  el.getBoundingClientRect().width / el.offsetWidth || 1;

// Marks the overlay's root (everything is measured relative to it), the box the canvas places
// its elements freely in (FREE mode) and the box it lays them out in (AUTO mode).
export const CANVAS_ROOT_ATTRIBUTE = "data-canvas-root";
export const FREE_ROOT_ATTRIBUTE = "data-canvas-free-root";
export const FLOW_ROOT_ATTRIBUTE = "data-canvas-flow-root";
// Marks the wrapper that places a free element, which knows the x/y it is drawn at.
export const FREE_ITEM_ATTRIBUTE = "data-free-item";
// Set on the root while an element is carried to another place, which hides the selection.
export const CARRYING_ATTRIBUTE = "data-carrying";

// A rectangle in canvas pixels, relative to the top left corner of the overlay.
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

// A line to draw over the canvas: vertical at x = `position` for the "x" axis, horizontal at
// y = `position` for "y", running from `start` to `end` along the other axis.
export interface Line {
  axis: "x" | "y";
  position: number;
  start: number;
  end: number;
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const measure = (el: Element, root: HTMLElement): Box => {
  const rootRect = root.getBoundingClientRect();
  const scale = rootRect.width / root.offsetWidth || 1;
  const rect = el.getBoundingClientRect();
  return {
    left: (rect.left - rootRect.left) / scale,
    top: (rect.top - rootRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
};

export const contains = (box: Box, x: number, y: number) =>
  x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;

// The element's own box: the first child of the `display: contents` wrapper ElementDisplay
// renders around it.
export const elementBox = (root: ParentNode, id: string) =>
  root.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(id)}"]`)?.firstElementChild ?? null;

// The box children of a freely placing parent are positioned in: inside a group's border, or
// the canvas itself.
export const freeAreaElement = (root: HTMLElement, parentId: string | null) =>
  parentId ? elementBox(root, parentId) : root.querySelector(`[${FREE_ROOT_ATTRIBUTE}]`);

export const freeArea = (el: Element, root: HTMLElement): Box => {
  const box = measure(el, root);
  return {
    left: box.left + el.clientLeft,
    top: box.top + el.clientTop,
    width: el.clientWidth,
    height: el.clientHeight,
  };
};

// Moves `position` (of a box `size` large) inside `area` (both relative to the area), as far
// as it fits. Elements larger than the area keep their top left corner in it.
export const clampInside = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  area: { width: number; height: number }
) => ({
  x: Math.round(clamp(position.x, 0, Math.max(0, area.width - size.width))),
  y: Math.round(clamp(position.y, 0, Math.max(0, area.height - size.height))),
});

// Where an element moved into a freely placing parent (null: the canvas) should go: where it
// is on screen right now, pulled inside the parent so it doesn't end up out of sight. Null
// when the editor canvas isn't showing it, so there's nothing to measure.
export const positionInside = (elementId: string, parentId: string | null) => {
  const wrapper = document.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(elementId)}"]`);
  const root = wrapper?.closest<HTMLElement>(`[${CANVAS_ROOT_ATTRIBUTE}]`);
  const box = wrapper?.firstElementChild;
  const areaElement = root && freeAreaElement(root, parentId);
  if (!root || !box || !areaElement) return null;
  const rect = measure(box, root);
  const area = freeArea(areaElement, root);
  return clampInside({ x: rect.left - area.left, y: rect.top - area.top }, rect, area);
};

// Snapping: the edges and centre lines of the dragged box are pulled onto those of the boxes
// around it.

type Edges = "all" | "end";

const linesOf = (box: Box, axis: Line["axis"], edges: Edges) => {
  const start = axis === "x" ? box.left : box.top;
  const size = axis === "x" ? box.width : box.height;
  return edges === "end" ? [start + size] : [start, start + size / 2, start + size];
};

const spanOf = (box: Box, axis: Line["axis"]) =>
  axis === "x" ? [box.top, box.top + box.height] : [box.left, box.left + box.width];

const snapAxis = (
  moving: Box,
  targets: Box[],
  axis: Line["axis"],
  edges: Edges,
  threshold: number
) => {
  let best: number | null = null;
  for (const target of targets) {
    for (const line of linesOf(target, axis, "all")) {
      for (const own of linesOf(moving, axis, edges)) {
        const distance = line - own;
        if (Math.abs(distance) <= threshold && (best === null || Math.abs(distance) < Math.abs(best))) {
          best = distance;
        }
      }
    }
  }
  return best ?? 0;
};

// How far `moving` has to move (or, with "end", grow) to line up with the closest target
// line within `threshold`, per axis.
export const snapOffset = (moving: Box, targets: Box[], threshold: number, edges: Edges = "all") => ({
  dx: snapAxis(moving, targets, "x", edges, threshold),
  dy: snapAxis(moving, targets, "y", edges, threshold),
});

// The guides to draw for a box that has been snapped: one per target line it lines up with,
// long enough to connect it with every box on that line. Positions are whole pixels, so a
// centre line half a pixel off still counts.
export const alignmentGuides = (moving: Box, targets: Box[], edges: Edges = "all"): Line[] => {
  const guides: Line[] = [];
  for (const axis of ["x", "y"] as const) {
    const byPosition = new Map<number, Line>();
    for (const target of targets) {
      for (const line of linesOf(target, axis, "all")) {
        if (!linesOf(moving, axis, edges).some((own) => Math.abs(own - line) <= 0.5)) continue;
        const [a0, a1] = spanOf(moving, axis);
        const [b0, b1] = spanOf(target, axis);
        const key = Math.round(line * 2) / 2;
        const existing = byPosition.get(key);
        byPosition.set(key, {
          axis,
          position: line,
          start: Math.min(a0, b0, existing?.start ?? Infinity),
          end: Math.max(a1, b1, existing?.end ?? -Infinity),
        });
      }
    }
    guides.push(...byPosition.values());
  }
  return guides;
};

// The editor sets `--canvas-zoom` on the zoomed canvas. Dividing by it keeps outlines, guides
// and labels the same size on screen at every zoom level.
export const unzoomed = (px: number) => `calc(${px}px / var(--canvas-zoom, 1))`;
