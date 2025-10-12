import React from "react";

export interface ContainerStyle {
  paddingX?: number;
  paddingY?: number;
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
}

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
    alignItems: safeStyle.alignItems || "stretch",
    paddingLeft: typeof safeStyle.paddingX === "number" ? `${safeStyle.paddingX}px` : undefined,
    paddingRight: typeof safeStyle.paddingX === "number" ? `${safeStyle.paddingX}px` : undefined,
    paddingTop: typeof safeStyle.paddingY === "number" ? `${safeStyle.paddingY}px` : undefined,
    paddingBottom: typeof safeStyle.paddingY === "number" ? `${safeStyle.paddingY}px` : undefined,
  };

  return (
    <div style={containerStyle}>
      {children}
    </div>
  );
};

export default Container;
