import { createContext, useContext } from "react";
import type { Box, Line } from "./canvasGeometry";

// What the canvas shows while something is dragged on it.
export interface DragFeedback {
  // Alignment guides the dragged (or resized) box snapped to.
  guides: Line[];
  // Where the dragged element would be inserted into a laid out parent.
  insertion: Line | null;
  // The parent it would be moved into, when that isn't the one it is in now.
  target: Box | null;
  // Its new x/y, shown under it.
  label: { box: Box; text: string } | null;
}

export const NO_FEEDBACK: DragFeedback = { guides: [], insertion: null, target: null, label: null };

// A freely placed element being moved inside its own parent is drawn here meanwhile.
export interface LivePosition {
  id: string;
  x: number;
  y: number;
}

// Pointer moves change these many times a second. Keeping them out of React state means only
// the dragged element and the drag layer re-render, not the whole canvas.
export const createDragStore = () => {
  let feedback = NO_FEEDBACK;
  let live: LivePosition | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getFeedback: () => feedback,
    getLive: () => live,
    set: (next: { feedback?: DragFeedback; live?: LivePosition | null }) => {
      if (next.feedback) feedback = next.feedback;
      if (next.live !== undefined) live = next.live;
      notify();
    },
    reset: () => {
      feedback = NO_FEEDBACK;
      live = null;
      notify();
    },
  };
};

export type DragStore = ReturnType<typeof createDragStore>;

export interface CanvasInteraction {
  store: DragStore;
  // Snaps a group being resized to the boxes around it and shows the guides.
  snapResize: (
    groupId: string,
    size: { width: number; height: number },
    modifiers: { altKey: boolean; shiftKey: boolean }
  ) => { width: number; height: number };
}

// Provided by the editor canvas while elements can be moved.
export const CanvasInteractionContext = createContext<CanvasInteraction | null>(null);

export const useCanvasInteraction = () => useContext(CanvasInteractionContext);
