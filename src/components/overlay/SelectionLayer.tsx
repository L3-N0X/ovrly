import { useEffect, useRef, type RefObject } from "react";
import { CANVAS_ELEMENT_ATTRIBUTE } from "./canvasSelection";

// The editor sets `--canvas-zoom` on the zoomed canvas. Dividing by it keeps outlines and the
// name label the same size on screen at every zoom level.
const unzoomed = (px: number) => `calc(${px}px / var(--canvas-zoom, 1))`;

// Draws the hover and selection outlines on top of the canvas. Elements move and resize
// without React knowing (dragging, timers, fonts loading), so the boxes are measured every
// frame and written straight to the DOM instead of going through state.
export const SelectionLayer = ({
  rootRef,
  selectedId,
  selectedName,
  hoveredIdRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  selectedId: string | null;
  selectedName?: string;
  hoveredIdRef: RefObject<string | null>;
}) => {
  const selectedRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = (box: HTMLDivElement | null, id: string | null) => {
      if (!box) return;
      const root = rootRef.current;
      const target =
        id &&
        root?.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(id)}"]`)?.firstElementChild;
      if (!root || !target) {
        box.style.display = "none";
        return;
      }
      // The editor scales the canvas, but the boxes are drawn in canvas pixels.
      const rootRect = root.getBoundingClientRect();
      const scale = rootRect.width / root.offsetWidth || 1;
      const rect = target.getBoundingClientRect();
      box.style.display = "block";
      box.style.left = `${(rect.left - rootRect.left) / scale}px`;
      box.style.top = `${(rect.top - rootRect.top) / scale}px`;
      box.style.width = `${rect.width / scale}px`;
      box.style.height = `${rect.height / scale}px`;
    };

    let frame = 0;
    const tick = () => {
      place(selectedRef.current, selectedId);
      const hoveredId = hoveredIdRef.current;
      place(hoveredRef.current, hoveredId !== selectedId ? hoveredId : null);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [rootRef, selectedId, hoveredIdRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={hoveredRef}
        className="absolute hidden outline-solid outline-sky-400/60"
        style={{ outlineWidth: unzoomed(2) }}
      />
      <div
        ref={selectedRef}
        className="absolute hidden outline-solid outline-sky-400"
        style={{ outlineWidth: unzoomed(2) }}
      >
        {selectedName && (
          // Sits on top of the box; the canvas outside the overlay is visible in the editor,
          // so there is room even for elements at the top edge.
          <span
            className="absolute bottom-full left-0 max-w-[300px] origin-bottom-left truncate rounded-t bg-sky-400 px-1.5 py-0.5 text-xs font-medium text-black"
            style={{
              transform: `translate(${unzoomed(-2)}, ${unzoomed(-2)}) scale(calc(1 / var(--canvas-zoom, 1)))`,
            }}
          >
            {selectedName}
          </span>
        )}
      </div>
    </div>
  );
};
