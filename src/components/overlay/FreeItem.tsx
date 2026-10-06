import React, { useRef, useState } from "react";
import type { GroupStyle, PrismaElement } from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasSelection } from "./canvasSelection";
import { canvasScale, snap } from "./canvasGeometry";

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// How far down an element that has never been placed is stacked, so elements that arrive
// without an x/y don't all land on the same spot.
const UNPLACED_STEP = 120;

interface DragStart {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
  scale: number;
}

// A direct child of a group (or of the canvas itself), placed at its own x/y. Draggable only
// while move mode is on.
const FreeItem: React.FC<{
  element: PrismaElement;
  children: React.ReactNode;
  // Where it sits among its siblings, used only while it has no position of its own.
  fallbackIndex?: number;
}> = ({ element, children, fallbackIndex = 0 }) => {
  const editing = useCanvasEditing();
  const selection = useCanvasSelection();
  const style = (element.style || {}) as GroupStyle;
  const x = toNumber(style.x, 0);
  // An element with a position of its own keeps it; one without is stacked below the ones
  // before it, rather than hidden under them.
  const y = toNumber(
    style.y,
    typeof style.x === "number" || typeof style.y === "number" ? 0 : fallbackIndex * UNPLACED_STEP
  );

  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  const position = dragPosition ?? { x, y };

  const positionStyle: React.CSSProperties = {
    position: "absolute",
    left: `${position.x}px`,
    top: `${position.y}px`,
  };

  if (!editing) {
    return <div style={positionStyle}>{children}</div>;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // In nested groups the innermost element under the pointer is the one that moves.
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus();
    selection?.onSelect(element.id);
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      x,
      y,
      scale: canvasScale(el),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    // Not limited to the group: elements may stick out of it, even past the overlay's edge.
    setDragPosition({
      x: snap(start.x + (e.clientX - start.pointerX) / start.scale, e.shiftKey),
      y: snap(start.y + (e.clientY - start.pointerY) / start.scale, e.shiftKey),
    });
  };

  const handlePointerUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (dragPosition && (dragPosition.x !== x || dragPosition.y !== y)) {
      editing.onMove(element.id, dragPosition);
    }
    setDragPosition(null);
  };

  const handlePointerCancel = () => {
    dragStart.current = null;
    setDragPosition(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    const delta = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    editing.onMove(element.id, { x: x + delta[0], y: y + delta[1] });
  };

  return (
    <div
      style={{ ...positionStyle, touchAction: "none", userSelect: "none" }}
      className="cursor-move outline-1 outline-dashed outline-sky-400/50 hover:outline-sky-400 focus:outline-2 focus:outline-solid focus:outline-sky-400"
      tabIndex={0}
      title={element.name}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      // Pointer capture sends the click to this wrapper instead of the element inside, so it
      // would bubble up and select the group. The element was selected on pointer down.
      onClick={(e) => e.stopPropagation()}
      // Images and selected text would otherwise start a native drag.
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
      {dragPosition && (
        <div className="absolute top-0 left-0 px-1 text-xs font-mono text-white bg-sky-500 rounded-br pointer-events-none whitespace-nowrap">
          {dragPosition.x}, {dragPosition.y}
        </div>
      )}
    </div>
  );
};

export default FreeItem;