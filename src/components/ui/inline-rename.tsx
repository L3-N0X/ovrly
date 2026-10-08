import * as React from "react";
import { cn } from "@/lib/utils";

interface InlineRenameProps {
  value: string;
  // Called with the new name, or with null when nothing changed (Escape, an empty or
  // unchanged name). Either way, editing is over.
  onDone: (name: string | null) => void;
  className?: string;
  "aria-label"?: string;
}

// A name edited in place, like a layer in Figma: it starts with everything selected, Enter
// or clicking elsewhere saves it, Escape keeps the old one.
export const InlineRename = ({ value, onDone, className, ...props }: InlineRenameProps) => {
  const [draft, setDraft] = React.useState(value);
  // What had focus before (a layer row, say), read while rendering, before autoFocus moves it.
  const [returnFocusTo] = React.useState(() => document.activeElement);
  // Enter and Escape end editing, after which the input blurs; that blur mustn't save again.
  const done = React.useRef(false);

  const finish = (save: boolean, fromKeyboard: boolean) => {
    if (done.current) return;
    done.current = true;
    const name = draft.trim();
    onDone(save && name && name !== value ? name : null);
    // Keyboard users carry on where they started. A click elsewhere has put focus where it
    // belongs already.
    if (fromKeyboard && returnFocusTo instanceof HTMLElement) {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (returnFocusTo.isConnected && (!active || active === document.body)) {
          returnFocusTo.focus();
        }
      });
    }
  };

  return (
    <input
      aria-label={props["aria-label"] ?? "Name"}
      value={draft}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(true, false)}
      onKeyDown={(e) => {
        // Keys typed here belong to the name, not to the list, canvas or dialog around it.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true, true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false, true);
        }
      }}
      // Clicks and drags inside the field are for placing the caret and selecting text.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      draggable={false}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={cn(
        "h-6 min-w-0 flex-1 rounded-sm border border-ring bg-background px-1 text-sm font-medium outline-none ring-2 ring-ring/30",
        className
      )}
    />
  );
};
