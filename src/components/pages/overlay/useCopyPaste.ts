import { useCallback, useEffect, useRef } from "react";
import { isInSubtree } from "@/components/overlay/editor/elementlist/tree";
import { copyElements, getElementClipboard, useElementClipboard } from "@/lib/elementClipboard";
import { isParentType, type OnOverlayChange, type PrismaElement, type PrismaOverlay } from "@/lib/types";
import { OVERLAY_SELECTION, type EditorSelection } from "./editorSelection";

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// Where a paste next to `targetId` goes: into it when it can hold elements (and isn't itself
// being pasted, which would nest a copy in the original), else next to it in its parent.
const parentForPaste = (elements: PrismaElement[], targetId: string | null, copiedIds: string[]) => {
  const target = elements.find((el) => el.id === targetId);
  if (!target) return null;
  const insideCopied = copiedIds.some((id) => isInSubtree(elements, target.id, id));
  return isParentType(target.type) && !insideCopied ? target.id : (target.parentId ?? null);
};

// Copying and pasting elements: Ctrl/Cmd + C and V (on the canvas and in the layers panel,
// anywhere but in text fields and dialogs), and the same through the layers context menu.
export const useCopyPaste = ({
  overlay,
  selectedId,
  enabled,
  onOverlayChange,
  onSelect,
}: {
  overlay: PrismaOverlay | null;
  selectedId: EditorSelection;
  enabled: boolean;
  onOverlayChange: OnOverlayChange;
  onSelect: (selection: EditorSelection) => void;
}) => {
  const clipboard = useElementClipboard();
  const pasting = useRef(false);
  const overlayId = overlay?.id;

  const copy = useCallback(
    (elementId: string) => overlayId && copyElements(overlayId, [elementId]),
    [overlayId]
  );

  // Pastes next to `targetId`: into it when it is a parent, else after it.
  const paste = useCallback(
    async (targetId: string | null) => {
      const copied = getElementClipboard();
      if (!overlay || !copied || pasting.current) return;
      pasting.current = true;
      try {
        const response = await fetch(`/api/overlays/${overlay.id}/elements/paste`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ids: copied.ids,
            parentId: parentForPaste(overlay.elements, targetId, copied.ids),
          }),
        });
        if (!response.ok) throw new Error(`Failed to paste (${response.status})`);

        // Only the pasted elements are taken from the response, like when adding one: adopting
        // all of it would revert edits that haven't been saved yet.
        const { pasted, elements }: PrismaOverlay & { pasted: string[] } = await response.json();
        const pastedIds = new Set(pasted);
        const added = elements.filter((el) => pastedIds.has(el.id));
        onOverlayChange((current) => {
          const known = new Set(current.elements.map((el) => el.id));
          return { ...current, elements: [...current.elements, ...added.filter((el) => !known.has(el.id))] };
        });
        // The copies themselves, not what is nested in them.
        const top = added.find((el) => !el.parentId || !pastedIds.has(el.parentId));
        if (top) onSelect(top.id);
      } catch (error) {
        console.error(error);
      } finally {
        pasting.current = false;
      }
    },
    [overlay, onOverlayChange, onSelect]
  );

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.repeat ||
        !(e.ctrlKey || e.metaKey) ||
        e.shiftKey ||
        e.altKey ||
        isEditableTarget(e.target) ||
        (e.target instanceof Element &&
          e.target.closest('[role="dialog"], [role="menu"], [role="listbox"]'))
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "c") {
        // Selected text on the page is copied the usual way.
        if (!selectedId || selectedId === OVERLAY_SELECTION || window.getSelection()?.toString()) {
          return;
        }
        e.preventDefault();
        copy(selectedId);
      } else if (key === "v" && getElementClipboard()) {
        e.preventDefault();
        paste(selectedId === OVERLAY_SELECTION ? null : selectedId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, selectedId, copy, paste]);

  return { copy, paste, canPaste: !!clipboard };
};
