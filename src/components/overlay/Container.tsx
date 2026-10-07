import React from "react";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  type ContainerStyle,
} from "@/lib/types";

interface ContainerProps {
  children: React.ReactNode;
  style: ContainerStyle;
}

const Container: React.FC<ContainerProps> = ({ children, style }) => {
  const safeStyle = style || {};
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
    width: "100%",
    height: "auto",
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
  };

  return <div style={containerStyle}>{children}</div>;
};

export default Container;
