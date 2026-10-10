import React from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTAINER_HEIGHT,
  DEFAULT_CONTAINER_WIDTH,
  type ContainerStyle,
  type PrismaElement,
} from "@/lib/types";
import { flexLayout, ParentLayoutContext, useFill } from "./fill";
import { useElementResize } from "./useElementResize";

const MIN_CONTAINER_SIZE = 20;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface ContainerProps {
  element: PrismaElement;
  children: React.ReactNode;
  style: ContainerStyle;
}

const Container: React.FC<ContainerProps> = ({ element, children, style }) => {
  const safeStyle = style || {};
  const fill = useFill(element);
  const fixedWidth = safeStyle.autoWidth !== true;
  const fixedHeight = safeStyle.autoHeight !== true;
  const { dragSize, handle } = useElementResize(element, MIN_CONTAINER_SIZE, {
    width: fixedWidth && !fill.width,
    height: fixedHeight && !fill.height,
  });
  const width = dragSize?.width ?? toNumber(safeStyle.width, DEFAULT_CONTAINER_WIDTH);
  const height = dragSize?.height ?? toNumber(safeStyle.height, DEFAULT_CONTAINER_HEIGHT);
  // A stroke is optional: without a width there is no border, whatever the colour says.
  const borderWidth =
    typeof safeStyle.borderWidth === "number"
      ? safeStyle.borderWidth
      : DEFAULT_BORDER_WIDTH;
  const borderRadius =
    typeof safeStyle.borderRadius === "number"
      ? safeStyle.borderRadius
      : DEFAULT_BORDER_RADIUS;
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: safeStyle.flexDirection || "column",
    gap: typeof safeStyle.gap === "number" ? `${safeStyle.gap}px` : undefined,
    justifyContent: safeStyle.justifyContent || "flex-start",
    // Automatic sizing hugs the children (or is stretched by a parent that stretches them).
    position: "relative",
    width: fixedWidth ? `${width}px` : "auto",
    height: fixedHeight ? `${height}px` : "auto",
    // A fixed side must not give way when the parent runs out of room.
    flexShrink: fixedWidth || fixedHeight ? 0 : undefined,
    boxSizing: "border-box",
    overflow: "hidden",
    alignItems: safeStyle.alignItems || "stretch",
    paddingLeft:
      typeof safeStyle.paddingX === "number"
        ? `${safeStyle.paddingX}px`
        : undefined,
    paddingRight:
      typeof safeStyle.paddingX === "number"
        ? `${safeStyle.paddingX}px`
        : undefined,
    paddingTop:
      typeof safeStyle.paddingY === "number"
        ? `${safeStyle.paddingY}px`
        : undefined,
    paddingBottom:
      typeof safeStyle.paddingY === "number"
        ? `${safeStyle.paddingY}px`
        : undefined,
    backgroundColor: safeStyle.backgroundColor,
    borderRadius: `${borderRadius}px`,
    border:
      borderWidth > 0
        ? `${borderWidth}px solid ${safeStyle.borderColor || DEFAULT_BORDER_COLOR}`
        : undefined,
    ...fill.style,
  };

  return (
    <div style={containerStyle}>
      <ParentLayoutContext.Provider value={flexLayout(containerStyle.flexDirection)}>
        {children}
      </ParentLayoutContext.Provider>
      {handle}
    </div>
  );
};

export default Container;
