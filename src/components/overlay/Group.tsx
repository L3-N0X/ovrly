import React, { useRef, useState } from "react";
import {
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  type GroupStyle,
  type PrismaElement,
} from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";

const MIN_GROUP_SIZE = 20;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Holding Shift snaps to a 10px grid.
const snap = (value: number, shiftKey: boolean) =>
  shiftKey ? Math.round(value / 10) * 10 : Math.round(value);

// The editor preview scales the 800x600 canvas down to fit, so pointer movement on screen
// has to be converted back into canvas pixels.
const canvasScale = (el: HTMLElement) => el.getBoundingClientRect().width / el.offsetWidth || 1;

interface DragStart {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;
  scale: number;
  maxX: number;
  maxY: number;
}

// A direct child of a group, placed at its own x/y. Draggable only while move mode is on.
const FreeItem: React.FC<{ element: PrismaElement; children: React.ReactNode }> = ({
  element,
  children,
}) => {
  const editing = useCanvasEditing();
  const style = (element.style || {}) as GroupStyle;
  const x = toNumber(style.x, 0);
  const y = toNumber(style.y, 0);

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

  // Keeps the element inside the group as long as it fits.
  const bounds = (el: HTMLElement) => ({
    maxX: Math.max(0, (el.parentElement?.clientWidth ?? 0) - el.offsetWidth),
    maxY: Math.max(0, (el.parentElement?.clientHeight ?? 0) - el.offsetHeight),
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // In nested groups the innermost element under the pointer is the one that moves.
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    el.focus();
    dragStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      x,
      y,
      scale: canvasScale(el),
      ...bounds(el),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    setDragPosition({
      x: clamp(snap(start.x + (e.clientX - start.pointerX) / start.scale, e.shiftKey), 0, start.maxX),
      y: clamp(snap(start.y + (e.clientY - start.pointerY) / start.scale, e.shiftKey), 0, start.maxY),
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
    const { maxX, maxY } = bounds(e.currentTarget);
    const next = {
      x: clamp(x + delta[0], 0, Math.max(maxX, x)),
      y: clamp(y + delta[1], 0, Math.max(maxY, y)),
    };
    if (next.x !== x || next.y !== y) editing.onMove(element.id, next);
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

interface GroupProps {
  element: PrismaElement;
  childElements: PrismaElement[];
  renderChild: (child: PrismaElement) => React.ReactNode;
}

// A fixed-size area whose children are positioned freely instead of being laid out with
// gaps and padding.
const Group: React.FC<GroupProps> = ({ element, childElements, renderChild }) => {
  const editing = useCanvasEditing();
  const style = (element.style || {}) as GroupStyle;
  const width = toNumber(style.width, DEFAULT_GROUP_WIDTH);
  const height = toNumber(style.height, DEFAULT_GROUP_HEIGHT);

  const [dragSize, setDragSize] = useState<{ width: number; height: number } | null>(null);
  const resizeStart = useRef<{ pointerX: number; pointerY: number; scale: number } | null>(null);
  const size = dragSize ?? { width, height };

  const handleResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Resizing a group must not also drag it around inside its own parent group.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const group = e.currentTarget.parentElement;
    resizeStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      scale: group ? canvasScale(group) : 1,
    };
  };

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    setDragSize({
      width: Math.max(
        MIN_GROUP_SIZE,
        snap(width + (e.clientX - start.pointerX) / start.scale, e.shiftKey)
      ),
      height: Math.max(
        MIN_GROUP_SIZE,
        snap(height + (e.clientY - start.pointerY) / start.scale, e.shiftKey)
      ),
    });
  };

  const handleResizeUp = () => {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    if (editing && dragSize && (dragSize.width !== width || dragSize.height !== height)) {
      editing.onResize(element.id, dragSize);
    }
    setDragSize(null);
  };

  return (
    <div
      style={{
        position: "relative",
        width: `${size.width}px`,
        height: `${size.height}px`,
        flexShrink: 0,
        overflow: "hidden",
        backgroundColor: style.backgroundColor,
        borderRadius: typeof style.radius === "number" ? `${style.radius}px` : undefined,
      }}
      className={editing ? "outline-1 -outline-offset-1 outline-dashed outline-white/40" : undefined}
    >
      {childElements.map((child) => (
        <FreeItem key={child.id} element={child}>
          {renderChild(child)}
        </FreeItem>
      ))}
      {editing && (
        <div
          className="absolute right-0 bottom-0 z-10 w-4 h-4 bg-sky-400 cursor-nwse-resize rounded-tl"
          style={{ touchAction: "none" }}
          title={`Resize ${element.name}`}
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          onPointerCancel={() => {
            resizeStart.current = null;
            setDragSize(null);
          }}
        />
      )}
      {dragSize && (
        <div className="absolute top-0 left-0 px-1 text-xs font-mono text-white bg-sky-500 rounded-br pointer-events-none">
          {dragSize.width} × {dragSize.height}
        </div>
      )}
    </div>
  );
};

export default Group;
