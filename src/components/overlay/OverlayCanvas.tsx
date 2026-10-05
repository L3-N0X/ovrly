import React, { useMemo, useRef } from "react";
import type { PrismaOverlay } from "@/lib/types";
import ElementDisplay from "./ElementDisplay";
import { CanvasEditingContext, type CanvasEditing } from "./canvasEditing";
import { CanvasSelectionContext, type CanvasSelection } from "./canvasSelection";
import { SelectionLayer } from "./SelectionLayer";

interface OverlayCanvasProps {
  overlay: PrismaOverlay;
  // Makes elements inside groups movable. Left out on the public page.
  editing?: CanvasEditing | null;
  // Lets elements be selected by clicking them. Left out on the public page.
  selection?: CanvasSelection | null;
}

const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  overlay,
  editing = null,
  selection = null,
}) => {
  const { globalStyle, elements } = overlay;
  const rootRef = useRef<HTMLDivElement>(null);
  // A ref rather than state: hovering shouldn't re-render the whole canvas, and the
  // selection layer reads it every frame anyway.
  const hoveredIdRef = useRef<string | null>(null);

  const selectionContext = useMemo(
    () =>
      selection && {
        ...selection,
        onHover: (elementId: string | null) => {
          hoveredIdRef.current = elementId;
        },
      },
    [selection]
  );

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
      <CanvasSelectionContext.Provider value={selectionContext}>
        <div
          ref={rootRef}
          style={outerStyle}
          // Elements stop these events themselves, so they only arrive here for empty space.
          onClick={selection ? () => selection.onSelect(null) : undefined}
          onPointerOver={selection ? () => (hoveredIdRef.current = null) : undefined}
          onPointerLeave={selection ? () => (hoveredIdRef.current = null) : undefined}
        >
          <div style={innerStyle}>
            {rootElements.map((element) => (
              <ElementDisplay key={element.id} element={element} elements={elements} />
            ))}
          </div>
          {selection && (
            <SelectionLayer
              rootRef={rootRef}
              selectedId={selection.selectedId}
              selectedName={elements.find((e) => e.id === selection.selectedId)?.name}
              hoveredIdRef={hoveredIdRef}
            />
          )}
        </div>
      </CanvasSelectionContext.Provider>
    </CanvasEditingContext.Provider>
  );
};

export default OverlayCanvas;
