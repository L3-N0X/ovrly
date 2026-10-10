import { createContext, useContext } from "react";
import type { Placement } from "./editor/elementlist/tree";

// Provided only by the editor preview while move mode is on. The public OBS page never
// provides it, so overlays rendered there are always static.
export interface CanvasEditing {
  onMove: (elementId: string, position: { x: number; y: number }) => void;
  // Only the sides that changed: an element can have one side sized automatically.
  onResize: (elementId: string, size: { width?: number; height?: number }) => void;
  // Moves the element into another parent (or to another index in its own). `position` is its
  // new x/y, for parents that place their children freely.
  onPlace: (elementId: string, placement: Placement, position: { x: number; y: number } | null) => void;
  // Whether dragged elements snap to the edges and centres around them. Alt bypasses it.
  snapping: boolean;
  // Whether Shift snaps to a 10px grid. Off while holding Shift is what turned the move tool on.
  shiftSnapsToGrid: boolean;
}

export const CanvasEditingContext = createContext<CanvasEditing | null>(null);

export const useCanvasEditing = () => useContext(CanvasEditingContext);
