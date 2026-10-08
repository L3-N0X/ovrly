import type { OnOverlayChange } from "@/lib/types";

// Renames an element right away and saves the name. If saving fails, the old name returns.
export const renameElement = async (
  elementId: string,
  previousName: string,
  name: string,
  onOverlayChange: OnOverlayChange
) => {
  const setName = (next: string) =>
    onOverlayChange((current) => ({
      ...current,
      elements: current.elements.map((el) => (el.id === elementId ? { ...el, name: next } : el)),
    }));

  setName(name);
  try {
    const response = await fetch(`/api/elements/${elementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error(`Failed to rename element (${response.status})`);
  } catch (error) {
    console.error(error);
    setName(previousName);
  }
};
