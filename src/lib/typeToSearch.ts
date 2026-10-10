// Moves focus into a search field when the user starts typing somewhere else, so the key they
// pressed lands in it. Returns whether it did. Ignores shortcuts, keys typed into fields and
// Space on a button (which presses it).
export const focusSearchOnType = (
  e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "target">,
  input: HTMLInputElement | null
): boolean => {
  if (!input || e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return false;
  const target = e.target instanceof HTMLElement ? e.target : null;
  if (target?.closest("input, textarea, select, [contenteditable='true']")) return false;
  if (e.key === " " && target?.closest("button, a, [role='tab']")) return false;
  input.focus();
  return true;
};
