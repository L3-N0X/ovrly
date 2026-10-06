import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ElementTypeEnum, type ElementType, type PrismaOverlay, type OnOverlayChange } from "@/lib/types";
import { GRID_ITEM_ATTRIBUTE, handleGridKeyDown } from "@/lib/gridNavigation";
import {
  AlertCircle,
  Frame,
  Grid3x3,
  Hash,
  Image,
  Loader2,
  Plus,
  Rows3,
  Timer,
  Type,
} from "lucide-react";

interface ElementOption {
  type: ElementType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: React.ReactNode;
}

// A small black stage, like the overlay itself, that the previews are drawn on.
const Stage = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div
    className={cn(
      "relative flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950 text-white",
      className
    )}
    style={{
      backgroundImage: "radial-gradient(circle, rgb(255 255 255 / 0.08) 1px, transparent 1px)",
      backgroundSize: "12px 12px",
    }}
  >
    {children}
  </div>
);

const BingoPreview = () => {
  const marked = new Set([0, 6, 8, 12, 16, 18, 24]);
  return (
    <div className="grid grid-cols-5 gap-px overflow-hidden rounded-sm border border-white/40 bg-white/40">
      {Array.from({ length: 25 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "flex h-3.5 w-3.5 items-center justify-center bg-neutral-900 text-[11px] leading-none font-black",
            marked.has(i) ? "text-red-500/85" : "text-transparent"
          )}
        >
          ✕
        </div>
      ))}
    </div>
  );
};

const CONTENT_OPTIONS: ElementOption[] = [
  {
    type: ElementTypeEnum.TITLE,
    label: "Title",
    description: "A line of text, like the game, a goal or your name.",
    icon: Type,
    preview: (
      <Stage>
        <span className="text-xl font-bold tracking-tight whitespace-nowrap">Any% Speedrun</span>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.COUNTER,
    label: "Counter",
    description: "A number you count up and down live, e.g. deaths or wins.",
    icon: Hash,
    preview: (
      <Stage>
        <span className="text-4xl font-bold tabular-nums">42</span>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.TIMER,
    label: "Timer",
    description: "A stopwatch or countdown you start, pause and reset.",
    icon: Timer,
    preview: (
      <Stage>
        <span className="text-2xl font-bold tabular-nums">01:23:45</span>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.IMAGE,
    label: "Image",
    description: "A logo, avatar or picture from a link or an upload.",
    icon: Image,
    preview: (
      <Stage>
        <div className="relative h-14 w-20 overflow-hidden rounded-md bg-gradient-to-b from-sky-400 to-sky-700">
          <div className="absolute top-2 right-3 h-3 w-3 rounded-full bg-amber-300" />
          <div className="absolute -bottom-3 -left-2 h-10 w-14 rotate-45 bg-emerald-600" />
          <div className="absolute -right-4 -bottom-5 h-12 w-14 rotate-45 bg-emerald-700" />
        </div>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.BINGO,
    label: "Bingo",
    description: "A bingo card whose fields you mark off while live.",
    icon: Grid3x3,
    preview: (
      <Stage>
        <BingoPreview />
      </Stage>
    ),
  },
];

const LAYOUT_OPTIONS: ElementOption[] = [
  {
    type: ElementTypeEnum.CONTAINER,
    label: "Container",
    description: "Lines up the elements inside it in a row or column, with spacing.",
    icon: Rows3,
    preview: (
      <Stage>
        <div className="flex flex-col gap-1 rounded-md border border-dashed border-sky-400/70 p-1.5">
          <div className="h-2.5 w-20 rounded-sm bg-white/80" />
          <div className="h-2.5 w-14 rounded-sm bg-white/50" />
          <div className="h-2.5 w-16 rounded-sm bg-white/50" />
        </div>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.GROUP,
    label: "Group",
    description: "An area where the elements inside are placed freely by dragging them.",
    icon: Frame,
    preview: (
      <Stage>
        <div className="relative h-16 w-28 rounded-md border border-dashed border-sky-400/70">
          <div className="absolute top-1.5 left-2 h-2.5 w-12 rounded-sm bg-white/80" />
          <div className="absolute right-3 bottom-2 h-6 w-6 rounded-sm bg-amber-400/80" />
          <div className="absolute bottom-3 left-5 h-2.5 w-8 rounded-sm bg-white/50" />
          {/* Elements may stick out of a group. */}
          <div className="absolute top-3 -right-3 h-4 w-7 rounded-sm bg-emerald-500/80" />
        </div>
      </Stage>
    ),
  },
];

interface AddElementModalProps {
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  // Called with the id of the new element, e.g. to select it.
  onAdded?: (elementId: string) => void;
  // The button that opens the dialog. Defaults to a small + button.
  children?: React.ReactNode;
  // Optional, to open the dialog from elsewhere (e.g. a keyboard shortcut).
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AddElementModal: React.FC<AddElementModalProps> = ({
  overlay,
  onOverlayChange,
  onAdded,
  children,
  open,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  // The type being added, while its request is on the way.
  const [adding, setAdding] = useState<ElementType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setOpen = (next: boolean) => {
    // Held open while adding, so the new element doesn't show up out of the blue.
    if (!next && adding) return;
    if (!next) setError(null);
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Adds the element right away. It's named after its type ("Counter 2"), like a new layer
  // in Figma, and can be renamed once it's clear what it is for.
  const handleAddElement = async (elementType: ElementType) => {
    if (adding) return;
    setAdding(elementType);
    setError(null);
    try {
      const response = await fetch(`/api/overlays/${overlay.id}/elements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ type: elementType }),
      });
      if (!response.ok) throw new Error(`Failed to add element (${response.status})`);

      // Only the new element is taken from the response. Adopting the whole response would
      // revert local edits that haven't been saved yet (and save the older values again).
      const updatedOverlay: PrismaOverlay = await response.json();
      const known = new Set(overlay.elements.map((el) => el.id));
      const newElement = updatedOverlay.elements.find((el) => !known.has(el.id));
      onOverlayChange((current) => {
        const known = new Set(current.elements.map((el) => el.id));
        const added = updatedOverlay.elements.filter((el) => !known.has(el.id));
        return { ...current, elements: [...current.elements, ...added] };
      });
      if (newElement) onAdded?.(newElement.id);
      setAdding(null);
      setInternalOpen(false);
      onOpenChange?.(false);
    } catch (err) {
      console.error(err);
      setError("The element couldn't be added. Please try again.");
      setAdding(null);
    }
  };

  const renderOptions = (title: string, options: ElementOption[], autoFocusFirst = false) => (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3">
        {options.map((option, index) => {
          const Icon = option.icon;
          const isAdding = adding === option.type;
          return (
            <button
              key={option.type}
              type="button"
              {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
              // Enter adds the first option straight away.
              autoFocus={autoFocusFirst && index === 0}
              onClick={() => handleAddElement(option.type)}
              aria-disabled={!!adding}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all outline-none",
                "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
                adding ? "cursor-default" : "cursor-pointer hover:border-primary/50 hover:shadow-md",
                adding && !isAdding && "opacity-50"
              )}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b">
                <div
                  className={cn(
                    "h-full w-full transition-transform duration-300",
                    !adding && "group-hover:scale-105"
                  )}
                >
                  {option.preview}
                </div>
                {isAdding && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {option.label}
                </div>
                <p className="text-xs leading-snug text-muted-foreground">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant="ghost" size="icon-sm" title="Add element" aria-label="Add element">
            <Plus />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,860px)] flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Add an element</DialogTitle>
          <DialogDescription>
            Click one to add it. It's selected right away, so you can style and rename it.
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5"
          onKeyDown={handleGridKeyDown}
        >
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          {renderOptions("Content", CONTENT_OPTIONS, true)}
          {renderOptions("Layout", LAYOUT_OPTIONS)}
        </div>
        <p className="hidden border-t bg-muted/30 px-6 py-2.5 text-xs text-muted-foreground sm:block">
          Arrow keys to move between elements · Enter to add · Esc to close
        </p>
      </DialogContent>
    </Dialog>
  );
};
