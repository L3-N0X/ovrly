import { ElementTypeEnum, type PrismaOverlay } from "@/lib/types";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  dropTargetForElements,
  monitorForElements,
  type ElementDropTargetEventBasePayload,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import React, { useEffect, useRef, useState } from "react";
import { AddElementModal } from "../AddElementModal";
import { ElementListItem } from "./ElementListItem";

export interface ElementListEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

export const ElementListEditor: React.FC<ElementListEditorProps> = ({
  overlay,
  onOverlayChange,
}) => {
  const rootElements = overlay.elements
    .filter((element) => !element.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const listRef = useRef(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    console.log("ElementListEditor closestEdge changed:", closestEdge);
  }, [closestEdge]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    function onChange(args: ElementDropTargetEventBasePayload) {
      const source = args.source;

      // Check if source is from the same list
      if (source.data.parentId === null) {
        // For root elements
        setClosestEdge(null);
        return;
      }

      const closestEdge = extractClosestEdge(args.self.data);
      setClosestEdge(closestEdge);
    }

    return combine(
      dropTargetForElements({
        element: el,
        getData: ({ input, element }) => {
          const data = { id: "root", parentId: null, type: "ROOT" };
          return attachClosestEdge(data, {
            input,
            element,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter: onChange,
        onDrag: onChange, // Important for continuous updates
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      })
    );
  }, [overlay]); // Add overlay to dependency array

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const target = location.current.dropTargets[0];

        // If no target is found or the target is the root, it means the element was dropped outside any specific drop target
        // This could mean it's being moved to the root level
        if (!target || (target.data.type === "ROOT" && target.data.id === "root")) {
          const sourceData = source.data;
          const newElements = [...overlay.elements];
          const sourceElement = newElements.find((e) => e.id === sourceData.id);
          if (!sourceElement) return;

          // If the element was inside a container, move it to root level
          if (sourceElement.parentId !== null) {
            sourceElement.parentId = null;

            // Update positions in the source list (old parent)
            const sourceList = newElements
              .filter((e) => e.parentId === sourceData.parentId)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            const startIndex = sourceList.findIndex((e) => e.id === sourceData.id);
            if (startIndex !== -1) {
              sourceList.splice(startIndex, 1);
              sourceList.forEach((item, index) => {
                const el = newElements.find((e) => e.id === item.id);
                if (el) el.position = index;
              });
            }

            // Update positions in the target list (root level)
            const rootElements = newElements
              .filter((e) => e.parentId === null)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            // Add the moved element to the end of the root list
            sourceElement.position = rootElements.length;

            onOverlayChange({ ...overlay, elements: newElements });

            fetch(`/api/elements/reorder`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "include",
              body: JSON.stringify({ elements: newElements, overlayId: overlay.id }),
            });
          }
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;

        if (sourceData.id === targetData.id) return;

        const newElements = [...overlay.elements];

        const sourceElement = newElements.find((e) => e.id === sourceData.id);
        if (!sourceElement) return;

        const sourceParentId = sourceData.parentId as string | null;
        const sourceList = newElements
          .filter((e) => e.parentId === sourceParentId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const startIndex = sourceList.findIndex((e) => e.id === sourceData.id);

        let targetParentId: string | null;
        if (targetData.type === ElementTypeEnum.CONTAINER) {
          // Check if we're moving from inside this container to outside (as a sibling)
          // If the source element is from inside this container, we should move it to be a sibling
          if (targetData.id === sourceElement.parentId) {
            // Moving from inside container to outside as a sibling
            targetParentId = null;
          } else {
            // Moving to inside this container
            targetParentId = targetData.id as string;
          }
        } else if (targetData.type === "ROOT") {
          targetParentId = null;
        } else {
          targetParentId = targetData.parentId as string | null;
        }

        if (sourceParentId === targetParentId) {
          // Reordering within the same list
          const targetList = sourceList;
          const indexOfTarget = targetList.findIndex((e) => e.id === targetData.id);
          if (indexOfTarget < 0) return;

          const finishIndex = getReorderDestinationIndex({
            startIndex,
            indexOfTarget,
            closestEdgeOfTarget: target.data.closestEdge as Edge | null,
            axis: "vertical",
          });

          const reorderedList = reorder({ list: targetList, startIndex, finishIndex });

          reorderedList.forEach((item, index) => {
            const element = newElements.find((e) => e.id === item.id);
            if (element) element.position = index;
          });
        } else {
          // Moving from one list to another
          sourceElement.parentId = targetParentId;

          const targetList = newElements
            .filter((e) => e.parentId === targetParentId)
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

          let finishIndex: number;
          const indexOfTarget = targetList.findIndex((e) => e.id === targetData.id);

          if (indexOfTarget >= 0) {
            // Dropped on an item
            finishIndex = getReorderDestinationIndex({
              startIndex: -1,
              indexOfTarget,
              closestEdgeOfTarget: target.data.closestEdge as Edge | null,
              axis: "vertical",
            });
          } else {
            // Dropped on a container (but not moving inside it)
            const closestEdge = target.data.closestEdge as Edge | null;
            if (closestEdge === "bottom") {
              finishIndex = targetList.length;
            } else {
              // 'top' or null - insert at the position of the container element
              const containerIndex = targetList.findIndex((e) => e.id === targetData.id);
              if (containerIndex !== -1) {
                finishIndex = closestEdge === "top" ? containerIndex : containerIndex + 1;
              } else {
                finishIndex = 0;
              }
            }
          }

          // Update positions in the source list
          sourceList.splice(startIndex, 1);
          sourceList.forEach((item, index) => {
            const el = newElements.find((e) => e.id === item.id);
            if (el) el.position = index;
          });

          // Update positions in the target list
          const newTargetList = [...targetList];
          newTargetList.splice(finishIndex, 0, sourceElement);
          newTargetList.forEach((item, index) => {
            const el = newElements.find((e) => e.id === item.id);
            if (el) {
              el.position = index;
            }
          });
        }

        onOverlayChange({ ...overlay, elements: newElements });

        fetch(`/api/elements/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ elements: newElements, overlayId: overlay.id }),
        });
      },
    });
  }, [overlay, onOverlayChange]);

  return (
    <div className="relative p-2 space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Elements</h3>
        <AddElementModal overlay={overlay} onOverlayChange={onOverlayChange} />
      </div>
      <div ref={listRef} className="space-y-2 relative">
        {rootElements.map((element) => (
          <ElementListItem
            key={element.id}
            element={element}
            onOverlayChange={onOverlayChange}
            overlay={overlay}
            className={element.type === ElementTypeEnum.CONTAINER ? "mb-3" : "mb-1"}
          />
        ))}
        {closestEdge && (
          <div
            style={{
              position: "absolute",
              top: closestEdge === "top" ? -2 : undefined,
              bottom: closestEdge === "bottom" ? -2 : undefined,
              left: "8px",
              right: "8px",
              height: "2px",
              backgroundColor: "white",
              boxShadow: "0 0 0 1px white",
              zIndex: 50,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    </div>
  );
};
