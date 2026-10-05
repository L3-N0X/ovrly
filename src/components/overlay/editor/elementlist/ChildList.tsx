import { type PrismaElement, type PrismaOverlay } from "@/lib/types";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import React, { useEffect, useRef, useState } from "react";
import { ElementListItem } from "./ElementListItem";

// The nested element list of a container or group, which is also the drop target for
// moving elements into it.
export const ChildList: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (newOverlay: PrismaOverlay) => void;
  onDeleteElement?: (elementId: string) => void;
}> = ({ element, overlay, onOverlayChange, onDeleteElement }) => {
  const children = overlay.elements
    .filter((e) => e.parentId === element.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(overlay.elements);
  useEffect(() => {
    elementsRef.current = overlay.elements;
  });
  const [isDraggedOver, setIsDraggedOver] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    return combine(
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          // Don't allow dropping a container into itself or anywhere inside its own subtree
          for (
            let currentId: string | null | undefined = element.id;
            currentId;
            currentId = elementsRef.current.find((e) => e.id === currentId)?.parentId
          ) {
            if (currentId === source.data.id) return false;
          }
          return true;
        },
        getData: () => {
          // No closest edge - this signals dropping INSIDE the container
          return {
            id: element.id,
            type: element.type,
            parentId: element.parentId,
          };
        },
        onDragEnter: () => {
          setIsDraggedOver(true);
        },
        onDragLeave: () => {
          setIsDraggedOver(false);
        },
        onDrop: () => {
          setIsDraggedOver(false);
        },
      })
    );
  }, [element.id, element.type, element.parentId]);

  return (
    <div
      ref={containerRef}
      className={`p-2 rounded-lg space-y-2 min-h-[80px] relative transition-colors ${
        isDraggedOver ? "bg-chart-1/20 border-2 border-chart-1 border-dashed" : "bg-muted/50"
      }`}
    >
      {children.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-6">
          Drop elements here
        </div>
      )}
      {children.map((child) => (
        <ElementListItem
          key={child.id}
          element={child}
          overlay={overlay}
          onOverlayChange={onOverlayChange}
          onDeleteElement={onDeleteElement}
        />
      ))}
    </div>
  );
};
