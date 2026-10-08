import { useSyncExternalStore } from "react";

// The colours picked last, newest first, shared by every colour picker. Kept in this browser
// only; without storage (private mode, blocked site data) the list lasts as long as the page.
const STORAGE_KEY = "ovrly:recent-colors";
const MAX_RECENT = 16;
const EMPTY: string[] = [];

let recent: string[] | null = null;
const listeners = new Set<() => void>();

const load = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((color): color is string => typeof color === "string").slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
};

const getSnapshot = () => (recent ??= load());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Picks made in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    recent = load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** Moves `hex` to the front of the recent colours. */
export const addRecentColor = (hex: string) => {
  const color = hex.toLowerCase();
  const current = getSnapshot();
  if (current[0] === color) return;
  recent = [color, ...current.filter((entry) => entry !== color)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  } catch {
    // Storage is unavailable; the list still lasts for this page.
  }
  listeners.forEach((listener) => listener());
};

export const useRecentColors = () => useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
