import React, { useSyncExternalStore } from "react";
import { fillOf, isElementVisible, type GroupStyle, type PrismaElement } from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasInteraction } from "./canvasDrag";
import { FREE_ITEM_ATTRIBUTE } from "./canvasGeometry";

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

// How far down an element that has never been placed is stacked, so elements that arrive
// without an x/y don't all land on the same spot.
const UNPLACED_STEP = 120;

const subscribeToNothing = () => () => {};

// A direct child of a group (or of the canvas itself), placed at its own x/y. Dragging it is
// handled by the canvas (see useCanvasGestures), which draws it at `live` meanwhile.
const FreeItem: React.FC<{
  element: PrismaElement;
  children: React.ReactNode;
  // Where it sits among its siblings, used only while it has no position of its own.
  fallbackIndex?: number;
}> = ({ element, children, fallbackIndex = 0 }) => {
  const editing = useCanvasEditing();
  const interaction = useCanvasInteraction();
  const live = useSyncExternalStore(interaction?.store.subscribe ?? subscribeToNothing, () => {
    const position = interaction?.store.getLive();
    return position?.id === element.id ? position : null;
  });
  const style = (element.style || {}) as GroupStyle;
  const x = toNumber(style.x, 0);
  // An element with a position of its own keeps it; one without is stacked below the ones
  // before it, rather than hidden under them.
  const y = toNumber(
    style.y,
    typeof style.x === "number" || typeof style.y === "number" ? 0 : fallbackIndex * UNPLACED_STEP
  );
  const position = live ?? { x, y };
  // A side that fills the parent spans all of it, whatever its x/y say (see useFill).
  const fill = fillOf(element);

  const positionStyle: React.CSSProperties = {
    position: "absolute",
    ...(fill.width ? { left: 0, right: 0 } : { left: `${position.x}px` }),
    ...(fill.height ? { top: 0, bottom: 0 } : { top: `${position.y}px` }),
  };

  // Nothing to place (see ElementDisplay).
  if (!isElementVisible(element)) return null;

  if (!editing) {
    return <div style={positionStyle}>{children}</div>;
  }

  return (
    <div
      {...{ [FREE_ITEM_ATTRIBUTE]: element.id }}
      style={positionStyle}
      className="outline-1 outline-dashed outline-sky-400/40"
    >
      {children}
    </div>
  );
};

export default FreeItem;
