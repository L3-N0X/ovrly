import { useSyncExternalStore } from "react";

// The elements that were copied (Ctrl+C or the layers context menu), waiting to be pasted. Only
// the ids are kept: the server clones them from the database, so everything they hold comes
// along (bindings, bingo cards, nested elements) and a copy can go to another overlay too.
export interface ElementClipboard {
  overlayId: string;
  ids: string[];
}

let clipboard: ElementClipboard | null = null;
const listeners = new Set<() => void>();

export const copyElements = (overlayId: string, ids: string[]) => {
  clipboard = { overlayId, ids };
  listeners.forEach((listener) => listener());
};

export const getElementClipboard = () => clipboard;

export const useElementClipboard = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getElementClipboard
  );
