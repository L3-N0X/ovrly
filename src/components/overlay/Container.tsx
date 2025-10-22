import React from "react";
import { type ContainerStyle } from "@/lib/types";

interface ContainerProps {
  children: React.ReactNode;
  style: ContainerStyle;
}

const Container: React.FC<ContainerProps> = ({ children, style }) => {
  const safeStyle = style || {};
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
    paddingLeft: typeof safeStyle.paddingX === "number" ? `${safeStyle.paddingX}px` : undefined,
    paddingRight: typeof safeStyle.paddingX === "number" ? `${safeStyle.paddingX}px` : undefined,
    paddingTop: typeof safeStyle.paddingY === "number" ? `${safeStyle.paddingY}px` : undefined,
    paddingBottom: typeof safeStyle.paddingY === "number" ? `${safeStyle.paddingY}px` : undefined,
  };

  return <div style={containerStyle}>{children}</div>;
};

export default Container;
