import React from "react";
import { Eye } from "lucide-react";
import OverlayPreview from "@/components/home/OverlayPreview";
import { ElementTypeIcon } from "@/components/overlay/editor/elementlist/ElementTypeIcon";
import { flattenTree } from "@/components/overlay/editor/elementlist/tree";
import { hasContent, type PrismaOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ElementContentControl, type ContentHandlers } from "./controls/ElementContentControl";

interface ControlViewProps {
  overlay: PrismaOverlay;
  role: "CONTROLLER" | "VIEWER";
  content: ContentHandlers;
  ownerName?: string;
}

// What controllers and viewers get instead of the editor: the live overlay and the content
// of its elements. Controllers run it from here, viewers only watch.
const ControlView: React.FC<ControlViewProps> = ({ overlay, role, content, ownerName }) => {
  const canControl = role === "CONTROLLER";
  // Same order as the layers panel in the editor.
  const elements = flattenTree(overlay.elements, new Set())
    .map((row) => row.element)
    .filter((element) => hasContent(element.type));

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-muted/20 p-4 sm:p-8">
        <div className="w-full max-w-[min(100%,calc((100dvh-10rem)*4/3))] overflow-hidden rounded-xl border shadow-sm">
          <OverlayPreview overlay={overlay} interactive={canControl} />
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live · what OBS shows right now
        </p>
      </main>

      <aside
        aria-label="Controls"
        className="shrink-0 border-t bg-background lg:w-[380px] lg:overflow-y-auto lg:border-t-0 lg:border-l"
      >
        <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b bg-background px-4">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Controls
          </span>
        </div>

        {!canControl && (
          <div className="m-4 flex gap-3 rounded-lg border bg-muted/30 p-3">
            <Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">View only.</span> You can watch this
              overlay live. Ask {ownerName ?? "its owner"} for control access to change it.
            </p>
          </div>
        )}

        {elements.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            This overlay has nothing to control yet.
          </p>
        ) : (
          // A disabled fieldset turns off every input and button inside it at once.
          <fieldset disabled={!canControl} className={cn(!canControl && "opacity-70")}>
            {elements.map((element) => (
              <section key={element.id} className="space-y-2 border-b px-4 py-3">
                <h3 className="flex items-center gap-1.5 text-sm font-medium">
                  <ElementTypeIcon
                    element={element}
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="truncate">{element.name}</span>
                </h3>
                <ElementContentControl element={element} handlers={content} />
              </section>
            ))}
          </fieldset>
        )}
      </aside>
    </div>
  );
};

export default ControlView;
