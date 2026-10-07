import React, { useRef, useState } from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  type GroupStyle,
  type PrismaElement,
} from "@/lib/types";
import FreeItem from "./FreeItem";
import { useCanvasEditing } from "./canvasEditing";
import { canvasScale, snap } from "./canvasGeometry";

const MIN_GROUP_SIZE = 20;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface GroupProps {
  element: PrismaElement;
  childElements: PrismaElement[];
  renderChild: (child: PrismaElement) => React.ReactNode;
}

// A fixed-size area whose children are positioned freely instead of being laid out with
// gaps and padding.
const Group: React.FC<GroupProps> = ({
  element,
  childElements,
  renderChild,
}) => {
  const editing = useCanvasEditing();
  const style = (element.style || {}) as GroupStyle;
  const width = toNumber(style.width, DEFAULT_GROUP_WIDTH);
  const height = toNumber(style.height, DEFAULT_GROUP_HEIGHT);
  // A stroke is optional: without a width there is no border, whatever the colour says.
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.radius, DEFAULT_BORDER_RADIUS);

  const [dragSize, setDragSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const resizeStart = useRef<{
    pointerX: number;
    pointerY: number;
    scale: number;
  } | null>(null);
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
        snap(width + (e.clientX - start.pointerX) / start.scale, e.shiftKey),
      ),
      height: Math.max(
        MIN_GROUP_SIZE,
        snap(height + (e.clientY - start.pointerY) / start.scale, e.shiftKey),
      ),
    });
  };

  const handleResizeUp = () => {
    if (!resizeStart.current) return;
    resizeStart.current = null;
    if (
      editing &&
      dragSize &&
      (dragSize.width !== width || dragSize.height !== height)
    ) {
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
        // Elements may stick out of the group unless it clips them.
        overflow: style.clip ? "hidden" : "visible",
        backgroundColor: style.backgroundColor,
        borderRadius: `${borderRadius}px`,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
            : undefined,
        // Keeps the border inside the group's size, so adding one doesn't shift its children.
        boxSizing: "border-box",
      }}
      className={
        editing
          ? "outline-1 -outline-offset-1 outline-dashed outline-white/40"
          : undefined
      }
    >
      {childElements.map((child, index) => (
        <FreeItem key={child.id} element={child} fallbackIndex={index}>
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
