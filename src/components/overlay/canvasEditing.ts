import { createContext, useContext } from "react";

// Provided only by the editor preview while move mode is on. The public OBS page never
// provides it, so overlays rendered there are always static.
export interface CanvasEditing {
  onMove: (elementId: string, position: { x: number; y: number }) => void;
  onResize: (elementId: string, size: { width: number; height: number }) => void;
}

export const CanvasEditingContext = createContext<CanvasEditing | null>(null);

export const useCanvasEditing = () => useContext(CanvasEditingContext);
