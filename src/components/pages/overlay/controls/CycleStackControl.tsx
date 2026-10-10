import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ElementTypeIcon } from "@/components/overlay/editor/elementlist/ElementTypeIcon";
import { resolveOverlay } from "@/lib/bindings";
import {
  cycleIntervalMs,
  cycleStackLayers,
  layerShown,
  useLayerShown,
  type CycleStackAction,
} from "@/lib/cycleStack";
import type { CycleStackStyle, PrismaElement, PrismaOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CycleStackControlProps {
  element: PrismaElement;
  overlay: PrismaOverlay;
  onAction: (elementId: string, action: CycleStackAction) => void;
}

// Which layer a cycle stack shows: playing and pausing it, stepping through the layers, or
// picking one. Pausing keeps the layer that is shown, so it can be worked on in the editor.
const CycleStackControl: React.FC<CycleStackControlProps> = ({ element, overlay, onAction }) => {
  // Resolved, since whether a layer is shown at all may be bound to a variable.
  const layers = useMemo(
    () => cycleStackLayers(resolveOverlay(overlay).elements, element.id),
    [overlay, element.id]
  );
  const intervalMs = cycleIntervalMs(element.style as CycleStackStyle | null);
  const { index, running } = useLayerShown(element.cycleStack, layers.length, intervalMs);
  const count = layers.length;

  if (count === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing to show yet. Every element you put inside the stack becomes one of its layers.
      </p>
    );
  }

  // Worked out at the click: the layer may have changed since the last render.
  const current = () => layerShown(element.cycleStack, count, intervalMs, Date.now()).index;
  const show = (next: number) =>
    onAction(element.id, { type: "show", index: ((next % count) + count) % count });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 min-w-0 flex-grow items-center gap-2 rounded-md bg-secondary px-2.5">
          <span className="shrink-0 font-mono text-base font-medium tabular-nums">
            {index + 1}/{count}
          </span>
          <span className="truncate text-sm text-muted-foreground">{layers[index]?.name}</span>
        </div>
        <Button
          onClick={() => show(current() - 1)}
          title="Previous layer"
          size="icon"
          variant="secondary"
          disabled={count < 2}
        >
          <ChevronLeft />
        </Button>
        <Button
          onClick={() =>
            onAction(
              element.id,
              element.cycleStack?.startedAt ? { type: "pause", index: current() } : { type: "play" }
            )
          }
          title={element.cycleStack?.startedAt ? "Pause on this layer" : "Cycle through the layers"}
          size="icon"
          variant="secondary"
        >
          {element.cycleStack?.startedAt ? <Pause /> : <Play />}
        </Button>
        <Button
          onClick={() => show(current() + 1)}
          title="Next layer"
          size="icon"
          variant="secondary"
          disabled={count < 2}
        >
          <ChevronRight />
        </Button>
      </div>
      <ol className="space-y-0.5" aria-label="Layers">
        {layers.map((layer, layerIndex) => (
          <li key={layer.id}>
            <button
              type="button"
              onClick={() => show(layerIndex)}
              aria-current={layerIndex === index ? "true" : undefined}
              title={layerIndex === index ? "Shown right now" : "Show this layer"}
              className={cn(
                "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-accent disabled:cursor-default",
                layerIndex === index && "bg-accent font-medium"
              )}
            >
              <span className="w-4 shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {layerIndex + 1}
              </span>
              <ElementTypeIcon element={layer} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{layer.name}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {!element.cycleStack?.startedAt
          ? "Paused: the layer shown stays up until you play it again."
          : running
            ? `Shows each layer for ${intervalMs / 1000}s. Pause to keep one up while you work on it.`
            : "It starts cycling once it has a second layer."}
      </p>
    </div>
  );
};

export default CycleStackControl;
