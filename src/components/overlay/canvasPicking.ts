import type { PrismaElement } from "@/lib/types";

// The chain of elements from the top level down to `id`, `id` included.
export const pathTo = (elements: PrismaElement[], id: string): string[] => {
  const path: string[] = [];
  for (let current: string | null = id; current; ) {
    path.unshift(current);
    current = elements.find((e) => e.id === current)?.parentId ?? null;
  }
  return path;
};

// What a press on `hitId` (the innermost element under the pointer) is about, like in Figma:
//
// - Elements are picked at the depth of the current selection: the top level ones at first,
//   and once something inside a container is selected, its siblings and the siblings of its
//   ancestors. So a click on a container selects the container, not the title in it.
// - Pressing inside the selection keeps it (so it can be dragged), and a click without a drag
//   then goes one level deeper (`dive`), towards the element under the pointer.
// - `deep` (Ctrl/Cmd + click) picks the innermost element right away.
export const pickTarget = (
  elements: PrismaElement[],
  hitId: string,
  selectedId: string | null,
  deep: boolean
): { target: string; dive: string | null } => {
  const path = pathTo(elements, hitId);
  if (deep) return { target: hitId, dive: null };

  const selectedIndex = selectedId ? path.indexOf(selectedId) : -1;
  if (selectedIndex >= 0) return { target: selectedId!, dive: path[selectedIndex + 1] ?? null };

  const context = new Set(selectedId ? pathTo(elements, selectedId).slice(0, -1) : []);
  let target = path[0];
  for (const id of path) {
    const parentId = elements.find((e) => e.id === id)?.parentId ?? null;
    if (parentId === null || context.has(parentId)) target = id;
  }
  return { target, dive: null };
};
