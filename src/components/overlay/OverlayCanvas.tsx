import React from "react";
import type { PrismaOverlay } from "@/lib/types";
import ElementDisplay from "./ElementDisplay";

interface OverlayCanvasProps {
  overlay: PrismaOverlay;
}

const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ overlay }) => {
  const { globalStyle, elements } = overlay;

  // For backward compatibility, we check for new property names first, then fallback to old ones
  const outerJustifyContent =
    globalStyle?.outerJustifyContent || globalStyle?.groupJustifyContent || "center";
  const outerAlignItems = globalStyle?.outerAlignItems || globalStyle?.groupAlignItems || "center";

  const innerJustifyContent =
    globalStyle?.innerJustifyContent || globalStyle?.justifyContent || "flex-start";
  const innerAlignItems = globalStyle?.innerAlignItems || globalStyle?.alignItems || "stretch";

  // Outer container handles overall alignment within the 800x600 space
  const outerStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    justifyContent: outerJustifyContent, // Horizontal alignment of inner container
    alignItems: outerAlignItems, // Vertical alignment of inner container
    overflow: "hidden",
    width: "800px",
    height: "600px",
  };

  // Inner container handles alignment of elements within the group
  const innerStyle: React.CSSProperties = {
    display: "flex",
    // position: "absolute",
    top: globalStyle?.top || 0,
    left: globalStyle?.left || 0,
    flexDirection: globalStyle?.flexDirection || "column",
    gap: `${globalStyle?.gap || 16}px`,
    justifyContent: innerJustifyContent, // Horizontal alignment of elements within group
    alignItems: innerAlignItems, // Vertical alignment of elements within group (when row) or horizontal alignment (when column)
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
