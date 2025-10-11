import React from "react";
import type { PrismaOverlay } from "@/lib/types";
import ElementDisplay from "./ElementDisplay";

interface OverlayCanvasProps {
  overlay: PrismaOverlay;
}

const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ overlay }) => {
  const { globalStyle, elements } = overlay;

  const outerStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    justifyContent: globalStyle?.groupJustifyContent || "center",
    alignItems: globalStyle?.groupAlignItems || "center",
    overflow: "hidden",
    width: "800px",
    height: "600px",
  };

  const innerStyle: React.CSSProperties = {
    display: "flex",
    position: "absolute",
    top: globalStyle?.top || 0,
    left: globalStyle?.left || 0,
    flexDirection: globalStyle?.flexDirection || "column",
    gap: `${globalStyle?.gap || 16}px`,
    justifyContent: globalStyle?.justifyContent || "flex-start",
    alignItems: globalStyle?.alignItems || "stretch",
    backgroundColor: globalStyle?.backgroundColor,
    padding: globalStyle?.padding ? `${globalStyle.padding}px` : undefined,
    borderRadius: globalStyle?.radius ? `${globalStyle.radius}px` : undefined,
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        {elements.map((element) => (
          <ElementDisplay key={element.id} element={element} />
        ))}
      </div>
    </div>
  );
};

export default OverlayCanvas;
