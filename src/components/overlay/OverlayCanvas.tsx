import React, { useMemo, useRef } from "react";
import {
  canvasSize,
  CanvasModeEnum,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import ElementDisplay from "./ElementDisplay";
// Only the editor ever gets a selection context, so the marker it selects with comes along
// with it.
import { OVERLAY_SELECTION } from "@/components/pages/overlay/editorSelection";
import { CanvasEditingContext, type CanvasEditing } from "./canvasEditing";
import { CanvasSelectionContext, type CanvasSelection } from "./canvasSelection";
import FreeItem from "./FreeItem";
import { SelectionLayer } from "./SelectionLayer";

interface OverlayCanvasProps {
  overlay: PrismaOverlay;
  // Makes elements movable. Left out on the public page.
  editing?: CanvasEditing | null;
  // Lets elements be selected by clicking them. Left out on the public page.
  selection?: CanvasSelection | null;
  // Hides whatever sticks out of the overlay, as OBS does. The editor turns it off so
  // elements placed outside stay visible and selectable.
  clip?: boolean;
}

// The overlay as OBS renders it: the canvas, which is the overlay's own root group, and
// everything on it.
const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  overlay,
  editing = null,
  selection = null,
  clip = true,
}) => {
  const { globalStyle, elements } = overlay;
  const { width, height } = canvasSize(overlay);
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

  // Outer container handles overall alignment within the overlay
  const outerStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    justifyContent: outerJustifyContent, // Horizontal alignment of inner container
    alignItems: outerAlignItems, // Vertical alignment of inner container
    overflow: clip ? "hidden" : "visible",
    width: `${width}px`,
    height: `${height}px`,
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

  const renderChild = (element: PrismaElement) => (
    <ElementDisplay element={element} elements={elements} />
  );

  // The canvas is the overlay's root group, and its mode decides how the elements on it are
  // placed: laid out with the global arrangement, or freely at their own x/y. Either way it
  // is the overlay itself, so it is never an element of its own and can't be removed.
  const content =
    overlay.canvasMode === CanvasModeEnum.FREE ? (
      <div className="relative" style={{ width: `${width}px`, height: `${height}px` }}>
        {rootElements.map((element, index) => (
          <FreeItem key={element.id} element={element} fallbackIndex={index}>
            {renderChild(element)}
          </FreeItem>
        ))}
      </div>
    ) : (
      <div style={innerStyle}>
        {rootElements.map((element) => (
          <React.Fragment key={element.id}>{renderChild(element)}</React.Fragment>
        ))}
      </div>
    );

  return (
    <CanvasEditingContext.Provider value={editing}>
      <CanvasSelectionContext.Provider value={selectionContext}>
        <div
          ref={rootRef}
          style={outerStyle}
          // Elements stop these events themselves, so they only arrive here for the empty
          // canvas, which is the overlay itself: clicking it opens the canvas settings.
          onClick={selection ? () => selection.onSelect(OVERLAY_SELECTION) : undefined}
          onPointerOver={selection ? () => (hoveredIdRef.current = null) : undefined}
          onPointerLeave={selection ? () => (hoveredIdRef.current = null) : undefined}
        >
          {content}
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
