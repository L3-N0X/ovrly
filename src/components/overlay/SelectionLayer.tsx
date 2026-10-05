import { useEffect, useRef, type RefObject } from "react";
import { CANVAS_ELEMENT_ATTRIBUTE } from "./canvasSelection";

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
      // The preview scales the canvas down, but the boxes are drawn in canvas pixels.
      const rootRect = root.getBoundingClientRect();
      const scale = rootRect.width / root.offsetWidth || 1;
      const rect = target.getBoundingClientRect();
      const top = (rect.top - rootRect.top) / scale;
      box.style.display = "block";
      box.style.left = `${(rect.left - rootRect.left) / scale}px`;
      box.style.top = `${top}px`;
      box.style.width = `${rect.width / scale}px`;
      box.style.height = `${rect.height / scale}px`;
      // No room for the name label above an element at the top edge
      box.dataset.labelInside = String(top < 24);
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
      <div ref={hoveredRef} className="absolute hidden outline-2 outline-sky-400/60" />
      <div ref={selectedRef} className="group/selection absolute hidden outline-3 outline-sky-400">
        {selectedName && (
          <span className="absolute -top-7 -left-[3px] max-w-[300px] truncate rounded-t bg-sky-400 px-2 py-0.5 text-sm font-medium text-black group-data-[label-inside=true]/selection:top-0 group-data-[label-inside=true]/selection:left-0 group-data-[label-inside=true]/selection:rounded-t-none group-data-[label-inside=true]/selection:rounded-br">
            {selectedName}
          </span>
        )}
      </div>
    </div>
  );
};
