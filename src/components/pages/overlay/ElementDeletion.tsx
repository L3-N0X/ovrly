import { useEffect, useState } from "react";
import { Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ElementTypeIcon } from "@/components/overlay/editor/elementlist/ElementTypeIcon";
import type { PrismaElement } from "@/lib/types";

// Asks before deleting `elements` (an element followed by everything nested inside it).
export const DeleteElementDialog = ({
  elements,
  onConfirm,
  onCancel,
}: {
  elements: PrismaElement[] | null;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  // Kept while the dialog animates out, after `elements` has been cleared.
  const [shown, setShown] = useState(elements);
  if (elements && elements !== shown) setShown(elements);

  const [element, ...nested] = shown ?? [];
  return (
    <ConfirmDialog
      open={!!elements}
      onOpenChange={(open) => !open && onCancel()}
      title={<>Delete “{element?.name}”?</>}
      description={
        nested.length > 0
          ? `Everything inside it goes with it: ${nested.length} nested ${
              nested.length === 1 ? "element" : "elements"
            }. You can undo this for a few seconds afterwards.`
          : "You can undo this for a few seconds afterwards."
      }
      confirmLabel="Delete"
      icon={<Trash2 />}
      destructive
      onConfirm={onConfirm}
    >
      {nested.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-2 text-sm">
          {nested.map((child) => (
            <li key={child.id} className="flex items-center gap-2">
              <ElementTypeIcon element={child} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{child.name}</span>
            </li>
          ))}
        </ul>
      )}
    </ConfirmDialog>
  );
};

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

// Shown after a deletion until it can no longer be undone. Ctrl/Cmd + Z undoes it too, except
// while typing, where it belongs to the text field.
export const UndoDeleteToast = ({
  name,
  duration,
  onUndo,
  onDismiss,
}: {
  name: string;
  duration: number;
  onUndo: () => void;
  onDismiss: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        onUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onUndo]);

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 animate-in items-center gap-3 overflow-hidden rounded-lg border bg-background py-2 pr-2 pl-4 shadow-lg fade-in-0 slide-in-from-bottom-4"
    >
      <span className="truncate text-sm">
        Deleted <span className="font-medium">{name}</span>
      </span>
      <Button size="sm" variant="secondary" onClick={onUndo} title="Undo (Ctrl+Z)">
        <Undo2 />
        Undo
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={onDismiss}>
        <X />
      </Button>
      {/* Runs out together with the time left to undo. */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-primary/60"
        style={{ animation: `countdown ${duration}ms linear forwards` }}
      />
    </div>
  );
};
