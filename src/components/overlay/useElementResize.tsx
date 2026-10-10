import React, { useRef, useState } from "react";
import type { PrismaElement } from "@/lib/types";
import { useCanvasEditing } from "./canvasEditing";
import { useCanvasInteraction } from "./canvasDrag";
import { useCanvasSelection } from "./canvasSelection";
import { canvasScale, snap } from "./canvasGeometry";

interface Size {
  width: number;
  height: number;
}

// A handle in the bottom right corner of an element that has a size of its own (groups and
// images). `size` is what the element should be drawn at: the size being dragged to, if any.
// The handle is only there while elements can be moved on the canvas, and only when at least
// one of the `axes` may be resized; the other one keeps the size it has.
export const useElementResize = (
  element: PrismaElement,
  minSize: number,
  axes: { width: boolean; height: boolean } = { width: true, height: true }
) => {
  const editing = useCanvasEditing();
  const interaction = useCanvasInteraction();
  const selection = useCanvasSelection();

  const [dragSize, setDragSize] = useState<Size | null>(null);
  // The size is read from the element's box, because an image without a stored size is drawn
  // at whatever the picture measures.
  const resizeStart = useRef<(Size & { pointerX: number; pointerY: number; scale: number }) | null>(
    null
  );

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Resizing must not also drag the element around inside its own parent group.
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    selection?.onSelect(element.id);
    const box = e.currentTarget.parentElement;
    resizeStart.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      width: box?.offsetWidth ?? 0,
      height: box?.offsetHeight ?? 0,
      scale: box ? canvasScale(box) : 1,
    };
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStart.current;
    if (!start) return;
    const grid = e.shiftKey && !!editing?.shiftSnapsToGrid;
    const size = {
      width: axes.width
        ? snap(start.width + (e.clientX - start.pointerX) / start.scale, grid)
        : start.width,
      height: axes.height
        ? snap(start.height + (e.clientY - start.pointerY) / start.scale, grid)
        : start.height,
    };
    // Lines its right and bottom edges up with what's around it, unless Alt is held.
    const snapped = interaction ? interaction.snapResize(element.id, size, e) : size;
    setDragSize({
      width: axes.width ? Math.max(minSize, snapped.width) : start.width,
      height: axes.height ? Math.max(minSize, snapped.height) : start.height,
    });
  };

  const handleCancel = () => {
    resizeStart.current = null;
    interaction?.store.reset();
    setDragSize(null);
  };

  const handleUp = () => {
    const start = resizeStart.current;
    if (!start) return;
    resizeStart.current = null;
    interaction?.store.reset();
    if (editing && dragSize) {
      const patch = {
        ...(axes.width && dragSize.width !== start.width && { width: dragSize.width }),
        ...(axes.height && dragSize.height !== start.height && { height: dragSize.height }),
      };
      if (Object.keys(patch).length > 0) editing.onResize(element.id, patch);
    }
    setDragSize(null);
  };

  const handle = editing && (axes.width || axes.height) && (
    <>
      <div
        className="absolute right-0 bottom-0 z-10 w-4 h-4 bg-sky-400 cursor-nwse-resize rounded-tl"
        style={{ touchAction: "none" }}
        title={`Resize ${element.name}`}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleCancel}
        // The click would otherwise reach the canvas, which picks elements by its own rules.
        onClick={(e) => e.stopPropagation()}
      />
      {dragSize && (
        <div className="absolute top-0 left-0 px-1 text-xs font-mono text-white bg-sky-500 rounded-br pointer-events-none">
          {dragSize.width} × {dragSize.height}
        </div>
      )}
    </>
  );

  return { dragSize, handle };
};
