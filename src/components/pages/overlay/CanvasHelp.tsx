import React from "react";
import { CircleHelp, MousePointer2, Move, Navigation, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-b-2 bg-muted px-1.5 font-sans text-[11px] font-medium text-foreground">
    {children}
  </kbd>
);

// A key combination: ["Ctrl", "Scroll"] reads "Ctrl + Scroll".
const Keys = ({ keys }: { keys: string[] }) => (
  <span className="flex flex-wrap items-center gap-1">
    {keys.map((key, i) => (
      <React.Fragment key={key}>
        {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
        <Key>{key}</Key>
      </React.Fragment>
    ))}
  </span>
);

interface Row {
  // Shown as keys, or as plain words for mouse gestures.
  keys?: string[];
  gesture?: string;
  action: string;
}

const Section = ({
  icon,
  title,
  intro,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  intro?: string;
  rows: Row[];
}) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
    {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
    <dl className="divide-y rounded-lg border">
      {rows.map((row) => (
        <div
          key={row.action}
          className="grid grid-cols-[minmax(0,11rem)_1fr] items-center gap-3 px-3 py-2 text-sm"
        >
          <dt>
            {row.keys ? (
              <Keys keys={row.keys} />
            ) : (
              <span className="text-xs font-medium">{row.gesture}</span>
            )}
          </dt>
          <dd className="text-muted-foreground">{row.action}</dd>
        </div>
      ))}
    </dl>
  </section>
);

// The canvas controls, explained. Opens from the "?" in the corner of the editor.
export function CanvasHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute bottom-3 left-3 rounded-full border bg-background/90 shadow-md backdrop-blur"
          title="How the canvas works"
          aria-label="How the canvas works"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CircleHelp />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Using the canvas</DialogTitle>
          <DialogDescription>
            Pick a tool in the toolbar, or press its key. The Select tool is for choosing and
            editing, the Move tool for arranging.
          </DialogDescription>
        </DialogHeader>

        <Section
          icon={<MousePointer2 />}
          title="Select tool"
          intro="Press V. Click things to edit them in the inspector."
          rows={[
            { gesture: "Click", action: "Select the element under the cursor." },
            { gesture: "Click again", action: "Go one level inside a group." },
            { keys: ["Ctrl", "Click"], action: "Select the innermost element directly." },
            { gesture: "Click empty canvas", action: "Open the overlay's canvas settings." },
            { keys: ["Shift"], action: "Hold to use the move tool until you let go." },
          ]}
        />

        <Section
          icon={<Move />}
          title="Move tool"
          intro="Press M. Drag elements to position them, reorder them or put them in another container."
          rows={[
            { gesture: "Drag", action: "Move, reorder, or drop into a group or the free canvas." },
            { keys: ["Arrows"], action: "Nudge the selected element by 1 px." },
            { keys: ["Shift", "Arrows"], action: "Nudge by 10 px." },
            { keys: ["Alt", "Drag"], action: "Turn snapping off while dragging." },
            { keys: ["Shift", "Drag"], action: "Snap to a 10 px grid instead of to other elements." },
            { keys: ["Ctrl", "Drag"], action: "Stay in the current parent, wherever you drop." },
            { keys: ["Esc"], action: "While dragging: cancel and put the element back." },
          ]}
        />

        <Section
          icon={<Navigation />}
          title="Moving around"
          rows={[
            { gesture: "Drag empty canvas", action: "Pan." },
            { keys: ["Space", "Drag"], action: "Pan, even when starting on an element." },
            { gesture: "Scroll", action: "Pan up and down. Hold Shift to pan sideways." },
            { gesture: "Two fingers", action: "Pinch to zoom and pan on touch screens." },
          ]}
        />

        <Section
          icon={<ZoomIn />}
          title="Zoom"
          rows={[
            { keys: ["Ctrl", "Scroll"], action: "Zoom towards the cursor (or pinch on a trackpad)." },
            { keys: ["+"], action: "Zoom in." },
            { keys: ["-"], action: "Zoom out." },
            { keys: ["Shift", "1"], action: "Zoom to fit." },
            { keys: ["Shift", "0"], action: "Zoom to 100%." },
          ]}
        />

        <Section
          icon={<CircleHelp />}
          title="Selection and shortcuts"
          rows={[
            { keys: ["Esc"], action: "Select the parent of the selected element." },
            { keys: ["Enter"], action: "Select the first child of the selected element." },
            { keys: ["A"], action: "Add an element." },
            { keys: ["Del"], action: "Delete the selected element." },
          ]}
        />
      </DialogContent>
    </Dialog>
  );
}
