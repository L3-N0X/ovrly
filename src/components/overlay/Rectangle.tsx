import React from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_RECTANGLE_HEIGHT,
  DEFAULT_RECTANGLE_WIDTH,
  type PrismaElement,
  type RectangleStyle,
} from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";
import { useElementResize } from "./useElementResize";

const MIN_RECTANGLE_SIZE = 1;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface RectangleProps {
  element: PrismaElement;
}

// A plain shape with a fill and an optional stroke, sized by dragging its corner or by the
// width and height in the settings.
const Rectangle: React.FC<RectangleProps> = ({ element }) => {
  const editing = useCanvasEditing();
  const style = (element.style || {}) as RectangleStyle;
  const width = toNumber(style.width, DEFAULT_RECTANGLE_WIDTH);
  const height = toNumber(style.height, DEFAULT_RECTANGLE_HEIGHT);
  // A stroke is optional: without a width there is no border, whatever the colour says.
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.borderRadius, DEFAULT_BORDER_RADIUS);

  const { dragSize, handle } = useElementResize(element, MIN_RECTANGLE_SIZE);
  const size = dragSize ?? { width, height };

  return (
    <div
      style={{
        position: "relative",
        width: `${size.width}px`,
        height: `${size.height}px`,
        flexShrink: 0,
        backgroundColor: style.backgroundColor,
        borderRadius: `${borderRadius}px`,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
            : undefined,
        // Keeps the border inside the rectangle's size, so adding one doesn't resize it.
        boxSizing: "border-box",
      }}
      className={
        editing
          ? "outline-1 -outline-offset-1 outline-dashed outline-white/40"
          : undefined
      }
    >
      {handle}
    </div>
  );
};

export default Rectangle;