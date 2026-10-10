import React from "react";
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
import { shadowStyle } from "./shadow";
import { useElementResize } from "./useElementResize";

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

  const { dragSize, handle } = useElementResize(element, MIN_GROUP_SIZE);
  const size = dragSize ?? { width, height };

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
        ...shadowStyle(style, { box: !!style.backgroundColor }),
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
      {handle}
    </div>
  );
};

export default Group;
