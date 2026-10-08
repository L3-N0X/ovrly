import { useSyncExternalStore, type RefObject } from "react";
import type { DragStore } from "./canvasDrag";
import { unzoomed, type Line } from "./canvasGeometry";

// Pastel red, so guides stand out from the blue selection without shouting.
const GUIDE_COLOR = "#ff8a65";

const LineMark = ({ line, color, width }: { line: Line; color: string; width: number }) => (
  <div
    className="absolute"
    style={
      line.axis === "x"
        ? {
            left: line.position,
            top: line.start,
            height: line.end - line.start,
            width: unzoomed(width),
            transform: "translateX(-50%)",
            backgroundColor: color,
          }
        : {
            top: line.position,
            left: line.start,
            width: line.end - line.start,
            height: unzoomed(width),
            transform: "translateY(-50%)",
            backgroundColor: color,
          }
    }
  />
);

// Draws what a drag on the canvas would do: the guides it snapped to, where it would be
// inserted, the parent it would move into and its new position. The copy of an element being
// carried to another parent is put into `ghostLayerRef` by useCanvasGestures.
export const DragLayer = ({
  store,
  ghostLayerRef,
}: {
  store: DragStore;
  ghostLayerRef: RefObject<HTMLDivElement | null>;
}) => {
  const { guides, insertion, target, label } = useSyncExternalStore(store.subscribe, store.getFeedback);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {target && (
        <div
          className="absolute outline-dashed outline-sky-400"
          style={{ ...target, outlineWidth: unzoomed(2) }}
        />
      )}
      <div ref={ghostLayerRef} className="absolute inset-0" />
      {guides.map((guide) => (
        <LineMark key={`${guide.axis}:${guide.position}`} line={guide} color={GUIDE_COLOR} width={1} />
      ))}
      {insertion && <LineMark line={insertion} color="var(--color-sky-500)" width={3} />}
      {label && (
        <span
          className="absolute origin-top-left rounded px-1 py-px font-mono text-xs whitespace-nowrap text-black"
          style={{
            left: label.box.left,
            top: label.box.top + label.box.height,
            backgroundColor: GUIDE_COLOR,
            transform: `translateY(${unzoomed(4)}) scale(calc(1 / var(--canvas-zoom, 1)))`,
          }}
        >
          {label.text}
        </span>
      )}
    </div>
  );
};
