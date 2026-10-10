import React, { useRef, useState } from "react";
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
import { focusSearchOnType } from "@/lib/typeToSearch";
import { Input } from "@/components/ui/input";
import { insertComponent, type OverlayComponent } from "@/lib/components";
import { ComponentPicker, type Notice } from "@/components/library/ComponentPicker";
import { PanelTabs } from "@/components/pages/overlay/PanelTabs";
import {
  AlertCircle,
  Info,
  ChartNoAxesGantt,
  Frame,
  Grid3x3,
  Hash,
  Heart,
  HeartPulse,
  Hourglass,
  Image,
  Loader2,
  Plus,
  Rows3,
  ScrollText,
  Search,
  Shapes,
  Square,
  SquareStack,
  Star,
  Timer,
  Type,
  Zap,
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
    description: "A stopwatch that counts up. You start, pause and reset it.",
    icon: Timer,
    preview: (
      <Stage>
        <span className="text-2xl font-bold tabular-nums">01:23:45</span>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.COUNTDOWN,
    label: "Countdown",
    description: "Counts down from a length of time, or to a date and time.",
    icon: Hourglass,
    preview: (
      <Stage>
        <span className="text-2xl font-bold tabular-nums">00:04:59</span>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.SUBATHON,
    label: "Subathon",
    description: "A countdown that Twitch subs and cheers add time to.",
    icon: HeartPulse,
    preview: (
      <Stage>
        <div className="relative">
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-semibold text-emerald-300">
            +5m
          </span>
          <span className="text-2xl font-bold tabular-nums">12:34:56</span>
        </div>
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
    type: ElementTypeEnum.ICON,
    label: "Icon",
    description: "One of thousands of icons from Lucide, Phosphor, Tabler and Pixelarticons.",
    icon: Shapes,
    preview: (
      <Stage>
        <div className="flex items-center gap-3">
          <Heart className="size-9 text-rose-400" />
          <Star className="size-9 text-amber-300" />
          <Zap className="size-9 text-sky-300" />
        </div>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.PROGRESS,
    label: "Progress Bar",
    description: "A bar filled to a percentage or a value of a maximum, like a song's progress.",
    icon: ChartNoAxesGantt,
    preview: (
      <Stage>
        <div className="w-32 space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-3/5 rounded-full bg-emerald-400" />
          </div>
          <div className="flex justify-between text-[10px] text-white/60 tabular-nums">
            <span>1:52</span>
            <span>3:20</span>
          </div>
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
    type: ElementTypeEnum.SCROLLER,
    label: "Scroller",
    description:
      "Lines up the elements inside it in a box of a set size and scrolls through them when they don't fit.",
    icon: ScrollText,
    preview: (
      <Stage>
        <div className="relative h-16 w-24 overflow-hidden rounded-md border border-dashed border-sky-400/70">
          <div className="flex animate-[scroller-preview_6s_ease-in-out_infinite] flex-col gap-1 p-1.5">
            {[20, 14, 16, 12, 18, 14, 20].map((width, index) => (
              <div
                key={index}
                className="h-2.5 shrink-0 rounded-sm bg-white/60"
                style={{ width: `${width * 4}px` }}
              />
            ))}
          </div>
        </div>
      </Stage>
    ),
  },
  {
    type: ElementTypeEnum.CYCLE_STACK,
    label: "Cycle Stack",
    description:
      "Stacks the elements inside it on top of each other and shows them one at a time, switching every few seconds.",
    icon: SquareStack,
    preview: (
      <Stage>
        <div className="relative h-16 w-24 rounded-md border border-dashed border-sky-400/70">
          {["bg-white/70", "bg-amber-400/80", "bg-emerald-500/80"].map((color, index) => (
            <div
              key={color}
              className="absolute inset-0 flex items-center justify-center opacity-0"
              style={{ animation: `cycle-stack-preview 6s ${index * 2}s infinite` }}
            >
              <div className={cn("h-8 w-14 rounded-sm", color)} />
            </div>
          ))}
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
  {
    type: ElementTypeEnum.RECTANGLE,
    label: "Rectangle",
    description: "A plain shape with a fill and an optional border, sized however you like.",
    icon: Square,
    preview: (
      <Stage>
        <div className="h-16 w-28 rounded-md border-2 border-white/70 bg-white/10" />
      </Stage>
    ),
  },
];

const ADD_TABS = [
  { value: "elements", label: "Elements" },
  { value: "components", label: "My components" },
] as const;

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
  const [tab, setTab] = useState<"elements" | "components">("elements");
  // The type or component being added, while its request is on the way.
  const [adding, setAdding] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean) => {
    // Held open while adding, so the new element doesn't show up out of the blue.
    if (!next && adding) return;
    if (!next) {
      setNotice(null);
      setSearch("");
    }
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  // Takes the new elements (`added`, or the ones that weren't known before) from the overlay
  // the server answers with, selects the top one and closes the dialog. Adopting the whole
  // response would revert local edits that haven't been saved yet (and save the older values
  // again).
  const adopt = (updatedOverlay: PrismaOverlay, added?: string[]) => {
    const known = new Set(overlay.elements.map((el) => el.id));
    const addedIds = new Set(added ?? updatedOverlay.elements.filter((el) => !known.has(el.id)).map((el) => el.id));
    const newElements = updatedOverlay.elements.filter((el) => addedIds.has(el.id));
    onOverlayChange((current) => {
      const known = new Set(current.elements.map((el) => el.id));
      return { ...current, elements: [...current.elements, ...newElements.filter((el) => !known.has(el.id))] };
    });
    // The top one, not what is nested in it.
    const top = newElements.find((el) => !el.parentId || !addedIds.has(el.parentId));
    if (top) onAdded?.(top.id);
    setAdding(null);
    setSearch("");
    setInternalOpen(false);
    onOpenChange?.(false);
  };

  // Adds the element right away. It's named after its type ("Counter 2"), like a new layer
  // in Figma, and can be renamed once it's clear what it is for.
  const handleAddElement = async (elementType: ElementType) => {
    if (adding) return;
    setAdding(elementType);
    setNotice(null);
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
      adopt(await response.json());
    } catch (err) {
      console.error(err);
      setNotice({ tone: "error", message: "The element couldn't be added. Please try again." });
      setAdding(null);
    }
  };

  // Adds a copy of the component's elements at the end of the overlay.
  const handleAddComponent = async (component: OverlayComponent) => {
    if (adding) return;
    setAdding(component.id);
    setNotice(null);
    try {
      const { added, ...updatedOverlay } = await insertComponent(overlay.id, component.id);
      adopt(updatedOverlay, added);
    } catch (err) {
      console.error(err);
      setNotice({
        tone: "error",
        message: `The component couldn't be added. ${err instanceof Error ? err.message : ""}`.trim(),
      });
      setAdding(null);
    }
  };

  const term = search.trim().toLowerCase();
  const matches = (options: ElementOption[]) =>
    options.filter(
      (option) =>
        !term ||
        option.label.toLowerCase().includes(term) ||
        option.description.toLowerCase().includes(term)
    );
  const contentOptions = matches(CONTENT_OPTIONS);
  const layoutOptions = matches(LAYOUT_OPTIONS);

  // Enter in the search field adds the first match, the arrow keys move on to the cards.
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" && e.key !== "ArrowDown") return;
    const first = listRef.current?.querySelector<HTMLElement>(`[${GRID_ITEM_ATTRIBUTE}]`);
    if (!first) return;
    e.preventDefault();
    if (e.key === "Enter") first.click();
    else first.focus();
  };

  const renderOptions = (title: string, options: ElementOption[]) => (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3">
        {options.map((option) => {
          const Icon = option.icon;
          const isAdding = adding === option.type;
          return (
            <button
              key={option.type}
              type="button"
              {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
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
      <DialogContent
        className="flex max-h-[min(90dvh,860px)] flex-col gap-0 p-0 sm:max-w-4xl"
        // Typing anywhere in the dialog searches.
        onKeyDown={(e) => focusSearchOnType(e.nativeEvent, searchRef.current)}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Add an element</DialogTitle>
          <DialogDescription>
            Click one to add it. It's selected right away, so you can style and rename it.
          </DialogDescription>
        </DialogHeader>
        <PanelTabs label="Add" tabs={ADD_TABS} value={tab} onValueChange={setTab} />

        <div className="relative px-6 pt-4">
          <Search className="pointer-events-none absolute top-1/2 left-9 mt-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={tab === "elements" ? "Search elements…" : "Search components…"}
            aria-label={tab === "elements" ? "Search elements" : "Search components"}
            className="pl-9"
          />
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5"
          onKeyDown={handleGridKeyDown}
        >
          {notice && (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                notice.tone === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "bg-muted/50 text-muted-foreground"
              )}
            >
              {notice.tone === "error" ? (
                <AlertCircle className="size-4 shrink-0" />
              ) : (
                <Info className="size-4 shrink-0" />
              )}
              {notice.message}
            </p>
          )}
          {tab === "elements" ? (
            <>
              {contentOptions.length > 0 && renderOptions("Content", contentOptions)}
              {layoutOptions.length > 0 && renderOptions("Layout", layoutOptions)}
              {contentOptions.length === 0 && layoutOptions.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No elements match “{search.trim()}”.
                </p>
              )}
            </>
          ) : (
            <ComponentPicker
              search={search}
              variables={overlay.variables}
              adding={adding}
              disabled={!!adding}
              onPick={handleAddComponent}
              onNotice={setNotice}
            />
          )}
        </div>
        <p className="hidden border-t bg-muted/30 px-6 py-2.5 text-xs text-muted-foreground sm:block">
          Arrow keys to move between {tab === "elements" ? "elements" : "components"} · Enter to
          add · Esc to close
        </p>
      </DialogContent>
    </Dialog>
  );
};
