import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PrismaElement } from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasInteraction } from "./canvasDrag";
import { useCanvasSelection } from "./canvasSelection";
import {
  CANVAS_ROOT_ATTRIBUTE,
  canvasScale,
  elementBox,
  FREE_ITEM_ATTRIBUTE,
  measure,
  snap,
  unzoomed,
  type Box,
  type Edges,
} from "./canvasGeometry";

interface Size {
  width: number;
  height: number;
}

// -1 drags the left (or top) side, 1 the right (or bottom) one, 0 leaves that axis alone.
type Side = -1 | 0 | 1;

interface Direction {
  key: string;
  x: Side;
  y: Side;
}

// The edges come first, so the corners are drawn on top of them where they overlap.
const DIRECTIONS: Direction[] = [
  { key: "n", x: 0, y: -1 },
  { key: "s", x: 0, y: 1 },
  { key: "w", x: -1, y: 0 },
  { key: "e", x: 1, y: 0 },
  { key: "nw", x: -1, y: -1 },
  { key: "ne", x: 1, y: -1 },
  { key: "sw", x: -1, y: 1 },
  { key: "se", x: 1, y: 1 },
];

// On screen, whatever the zoom: the corner squares and the grab area along each edge.
const KNOB_SIZE = 8;
const EDGE_SIZE = 8;

const cursorOf = (x: Side, y: Side) =>
  x === 0 ? "ns-resize" : y === 0 ? "ew-resize" : x === y ? "nwse-resize" : "nesw-resize";

// Centred on the side (or corner) of the selection outline it drags.
const handleStyle = ({ x, y }: Direction, cursor: string): React.CSSProperties => {
  const corner = x !== 0 && y !== 0;
  const size = unzoomed(corner ? KNOB_SIZE : EDGE_SIZE);
  return {
    position: "absolute",
    left: x === 1 ? "100%" : 0,
    top: y === 1 ? "100%" : 0,
    width: x === 0 ? "100%" : size,
    height: y === 0 ? "100%" : size,
    transform: `translate(${x === 0 ? 0 : "-50%"}, ${y === 0 ? 0 : "-50%"})`,
    cursor,
    touchAction: "none",
    ...(corner && { borderWidth: unzoomed(1) }),
  };
};

interface ResizeStart extends Size {
  pointerX: number;
  pointerY: number;
  scale: number;
  x: Side;
  y: Side;
  // The element's box on the canvas, for snapping.
  box: Box;
  // Its x/y while it is placed freely, which moves when its left or top side is dragged. In a
  // laid out parent the layout decides where it goes, so only its size changes.
  position: { x: number; y: number } | null;
}

interface ResizeDrag {
  size: Size;
  position: { x: number; y: number } | null;
}

// Figma-style resize handles for an element that has a size of its own (groups, images and the
// like): a square on each corner and a grab area along each side, drawn on the selection outline
// while the element is selected and elements can be moved on the canvas. `size` is what the
// element should be drawn at: the size being dragged to, if any. Only the `axes` that may be
// resized are; the other one keeps the size it has. Dragging the left or top side of a freely
// placed element moves it too, so the opposite side stays where it is.
export const useElementResize = (
  element: PrismaElement,
  minSize: number,
  axes: { width: boolean; height: boolean } = { width: true, height: true }
) => {
  const editing = useCanvasEditing();
  const interaction = useCanvasInteraction();
  const selection = useCanvasSelection();

  const [dragSize, setDragSize] = useState<Size | null>(null);
  const resizeStart = useRef<ResizeStart | null>(null);
  const latestDrag = useRef<ResizeDrag | null>(null);

  const handleDown = (e: React.PointerEvent<HTMLDivElement>, x: Side, y: Side) => {
    if (e.button !== 0) return;
    // Resizing must not also start a drag on the canvas.
    e.stopPropagation();
    // The size is read from the element's box, because an image without a stored size is drawn
    // at whatever the picture measures.
    const root = e.currentTarget.closest<HTMLElement>(`[${CANVAS_ROOT_ATTRIBUTE}]`);
    const box = root && elementBox(root, element.id);
    if (!root || !(box instanceof HTMLElement)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const item = box.closest<HTMLElement>(`[${FREE_ITEM_ATTRIBUTE}]`);
    const free = item?.getAttribute(FREE_ITEM_ATTRIBUTE) === element.id;
    resizeStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: box.offsetWidth,
      height: box.offsetHeight,
      scale: canvasScale(root),
      x,
      y,
      box: measure(box, root),
      position: free && item ? { x: item.offsetLeft, y: item.offsetTop } : null,
    };
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    const grid = e.shiftKey && !!editing?.shiftSnapsToGrid;
    const size = {
      width: start.x
        ? snap(start.width + (start.x * (e.clientX - start.pointerX)) / start.scale, grid)
        : start.width,
      height: start.y
        ? snap(start.height + (start.y * (e.clientY - start.pointerY)) / start.scale, grid)
        : start.height,
    };
    // Lines the dragged edges up with what's around it, unless Alt is held. A start edge only
    // follows the pointer when the element is placed freely, so only then does it snap.
    const edgesOf = (side: Side): Edges =>
      side === 1 ? "end" : side === -1 && start.position ? "start" : "none";
    const box = {
      left: start.box.left + (start.x === -1 ? start.width - size.width : 0),
      top: start.box.top + (start.y === -1 ? start.height - size.height : 0),
      ...size,
    };
    const snapped = interaction
      ? interaction.snapResize(element.id, box, { x: edgesOf(start.x), y: edgesOf(start.y) }, e)
      : size;
    const next = {
      width: start.x ? Math.max(minSize, snapped.width) : start.width,
      height: start.y ? Math.max(minSize, snapped.height) : start.height,
    };
    const position = start.position && {
      x: start.position.x + (start.x === -1 ? start.width - next.width : 0),
      y: start.position.y + (start.y === -1 ? start.height - next.height : 0),
    };
    latestDrag.current = { size: next, position };
    if (position && (start.x === -1 || start.y === -1)) {
      interaction?.store.set({ live: { id: element.id, ...position } });
    }
    setDragSize(next);
  };

  const finish = () => {
    resizeStart.current = null;
    latestDrag.current = null;
    setDragSize(null);
  };

  const handleCancel = () => {
    finish();
    interaction?.store.reset();
  };

  const handleUp = () => {
    const start = resizeStart.current;
    const drag = latestDrag.current;
    if (!start) return;
    if (editing && drag) {
      const { size, position } = drag;
      const patch = {
        ...(start.x && size.width !== start.width && { width: size.width }),
        ...(start.y && size.height !== start.height && { height: size.height }),
        ...(position && position.x !== start.position?.x && { x: position.x }),
        ...(position && position.y !== start.position?.y && { y: position.y }),
      };
      if (Object.keys(patch).length > 0) editing.onResize(element.id, patch);
    }
    finish();
    // After the change, so the element doesn't flash at its old position in between.
    interaction?.store.reset();
  };

  const host = interaction?.handleHost;
  const handle =
    editing &&
    host &&
    selection?.selectedId === element.id &&
    (axes.width || axes.height) &&
    createPortal(
      <>
        {DIRECTIONS.map((direction) => {
          // A corner still resizes the side that may be resized; an edge along the other is
          // left out.
          const x = axes.width ? direction.x : 0;
          const y = axes.height ? direction.y : 0;
          if (x === 0 && y === 0) return null;
          const corner = direction.x !== 0 && direction.y !== 0;
          return (
            <div
              key={direction.key}
              className={
                corner
                  ? "pointer-events-auto border-solid border-sky-400 bg-white"
                  : "pointer-events-auto"
              }
              style={handleStyle(direction, cursorOf(x, y))}
              onPointerDown={(e) => handleDown(e, x, y)}
              onPointerMove={handleMove}
              onPointerUp={handleUp}
              onPointerCancel={handleCancel}
              // The click would otherwise reach the canvas, which picks elements by its own rules.
              onClick={(e) => e.stopPropagation()}
            />
          );
        })}
        {dragSize && (
          <span
            className="absolute top-full left-1/2 origin-top rounded bg-sky-400 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-black"
            style={{
              transform: `translate(-50%, ${unzoomed(KNOB_SIZE)}) scale(calc(1 / var(--canvas-zoom, 1)))`,
            }}
          >
            {dragSize.width} × {dragSize.height}
          </span>
        )}
      </>,
      host
    );

  return { dragSize, handle };
};
