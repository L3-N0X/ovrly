import React from "react";
import type { PrismaOverlay } from "@/lib/types";
import ElementDisplay from "./ElementDisplay";
import { CanvasEditingContext, type CanvasEditing } from "./canvasEditing";

interface OverlayCanvasProps {
  overlay: PrismaOverlay;
  // Makes elements inside groups movable. Left out on the public page.
  editing?: CanvasEditing | null;
}

const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ overlay, editing = null }) => {
  const { globalStyle, elements } = overlay;

  // For backward compatibility, we check for new property names first, then fallback to old ones
  const outerJustifyContent = globalStyle?.outerJustifyContent || "center";
  const outerAlignItems = globalStyle?.outerAlignItems || "center";

  const innerJustifyContent =
    globalStyle?.innerJustifyContent || globalStyle?.justifyContent || "flex-start";
  const innerAlignItems = globalStyle?.innerAlignItems || globalStyle?.alignItems || "center";

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
    flexDirection: globalStyle?.flexDirection || "column",
    gap: typeof globalStyle?.gap === "number" ? `${globalStyle.gap}px` : "16px",
    justifyContent: innerJustifyContent, // Horizontal alignment of elements within group
    alignItems: innerAlignItems, // Vertical alignment of elements within group (when row) or horizontal alignment (when column)
    backgroundColor: globalStyle?.backgroundColor,
    padding: typeof globalStyle?.padding === "number" ? `${globalStyle.padding}px` : undefined,
    borderRadius: typeof globalStyle?.radius === "number" ? `${globalStyle.radius}px` : undefined,
  };

  const rootElements = elements
    .filter((element) => !element.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <CanvasEditingContext.Provider value={editing}>
      <div style={outerStyle}>
        <div style={innerStyle}>
          {rootElements.map((element) => (
            <ElementDisplay key={element.id} element={element} elements={elements} />
          ))}
        </div>
      </div>
    </CanvasEditingContext.Provider>
  );
};

export default OverlayCanvas;
