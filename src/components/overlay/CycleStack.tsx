import React, { useMemo } from "react";
import {
  CYCLE_STACK_TRANSITION_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CYCLE_STACK_HEIGHT,
  DEFAULT_CYCLE_STACK_TRANSITION_DURATION,
  DEFAULT_CYCLE_STACK_WIDTH,
  type CycleStackStyle,
  type PrismaElement,
} from "@/lib/types";
import { cycleIntervalMs, cycleStackLayers, useLayerShown } from "@/lib/cycleStack";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasSelection } from "./canvasSelection";
import { useElementResize } from "./useElementResize";

const MIN_CYCLE_STACK_SIZE = 20;

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface CycleStackProps {
  element: PrismaElement;
  // Every element of the overlay, resolved, to find its layers and what the selection is in.
  elements: PrismaElement[];
  renderChild: (child: PrismaElement) => React.ReactNode;
}

// The layer `id` is (or is nested in), if it is in the stack at all.
const layerHolding = (elements: PrismaElement[], stackId: string, id: string | null) => {
  for (let current = id; current; ) {
    const element = elements.find((e) => e.id === current);
    if (!element) return null;
    if (element.parentId === stackId) return element.id;
    current = element.parentId ?? null;
  }
  return null;
};

// Its children are layers on top of each other, of which one is shown at a time: each for the
// interval while it cycles, or the one it was paused at. In the editor, a layer that is selected
// (or has something selected inside it) is shown instead, so it can be worked on.
const CycleStack: React.FC<CycleStackProps> = ({ element, elements, renderChild }) => {
  const editing = useCanvasEditing();
  const selection = useCanvasSelection();
  const style = (element.style || {}) as CycleStackStyle;
  const fitContent = style.fitContent === true;
  const borderWidth = toNumber(style.borderWidth, DEFAULT_BORDER_WIDTH);
  const borderRadius = toNumber(style.borderRadius, DEFAULT_BORDER_RADIUS);
  const fade = style.transition !== "none";
  const fadeSeconds = Math.min(
    CYCLE_STACK_TRANSITION_RANGE.max,
    Math.max(0, toNumber(style.transitionDuration, DEFAULT_CYCLE_STACK_TRANSITION_DURATION))
  );

  const { dragSize, handle } = useElementResize(element, MIN_CYCLE_STACK_SIZE, {
    width: !fitContent,
    height: !fitContent,
  });
  const width = dragSize?.width ?? toNumber(style.width, DEFAULT_CYCLE_STACK_WIDTH);
  const height = dragSize?.height ?? toNumber(style.height, DEFAULT_CYCLE_STACK_HEIGHT);

  const layers = useMemo(() => cycleStackLayers(elements, element.id), [elements, element.id]);
  const { index } = useLayerShown(element.cycleStack, layers.length, cycleIntervalMs(style));
  const pinned = selection ? layerHolding(elements, element.id, selection.selectedId) : null;
  const shownId = pinned && layers.some((layer) => layer.id === pinned) ? pinned : layers[index]?.id;

  const padding = (value: unknown) => `${toNumber(value, 0)}px`;

  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        // Every layer goes into the one cell, so they lie on top of each other. It is as big as
        // the biggest one when the box fits them, and as big as the box otherwise.
        gridTemplate: fitContent ? "auto / auto" : "minmax(0, 1fr) / minmax(0, 1fr)",
        justifyItems: style.justifyItems || "center",
        alignItems: style.alignItems || "center",
        flexShrink: 0,
        boxSizing: "border-box",
        overflow: "hidden",
        width: fitContent ? "fit-content" : `${width}px`,
        height: fitContent ? "auto" : `${height}px`,
        // Keeps a box without layers from collapsing out of reach.
        minWidth: fitContent ? `${MIN_CYCLE_STACK_SIZE}px` : undefined,
        minHeight: fitContent ? `${MIN_CYCLE_STACK_SIZE}px` : undefined,
        paddingLeft: padding(style.paddingX),
        paddingRight: padding(style.paddingX),
        paddingTop: padding(style.paddingY),
        paddingBottom: padding(style.paddingY),
        backgroundColor: style.backgroundColor,
        borderRadius: `${borderRadius}px`,
        border:
          borderWidth > 0
            ? `${borderWidth}px solid ${style.borderColor || DEFAULT_BORDER_COLOR}`
            : undefined,
      }}
      className={
        editing ? "outline-1 -outline-offset-1 outline-dashed outline-white/40" : undefined
      }
    >
      {layers.map((layer) => {
        const shown = layer.id === shownId;
        return (
          <div
            key={layer.id}
            aria-hidden={!shown}
            style={{
              gridArea: "1 / 1",
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              opacity: shown ? 1 : 0,
              // Hidden layers keep their size (so the box doesn't change with every layer when
              // it fits its content), but can't be clicked or picked on the canvas. Visibility
              // flips at the end of a fade out and at the start of a fade in.
              visibility: shown ? "visible" : "hidden",
              pointerEvents: shown ? undefined : "none",
              transition:
                fade && fadeSeconds > 0
                  ? `opacity ${fadeSeconds}s ease-in-out, visibility ${fadeSeconds}s`
                  : undefined,
            }}
          >
            {renderChild(layer)}
          </div>
        );
      })}
      {handle}
    </div>
  );
};

export default CycleStack;
