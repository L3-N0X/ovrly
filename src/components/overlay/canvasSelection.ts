import { createContext, useContext } from "react";

// Provided only by the editor preview, so elements can be picked by clicking them.
export interface CanvasSelection {
  selectedId: string | null;
  onSelect: (elementId: string | null) => void;
}

interface CanvasSelectionContextValue extends CanvasSelection {
  onHover: (elementId: string | null) => void;
}

export const CanvasSelectionContext = createContext<CanvasSelectionContextValue | null>(null);

export const useCanvasSelection = () => useContext(CanvasSelectionContext);

// Marks the wrapper ElementDisplay renders around each element (with `display: contents`,
// so layout is unaffected). Its first child is the element's actual box.
export const CANVAS_ELEMENT_ATTRIBUTE = "data-canvas-element";
