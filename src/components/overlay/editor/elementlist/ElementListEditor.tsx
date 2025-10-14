import { ElementTypeEnum, type PrismaOverlay } from "@/lib/types";
import {
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import React, { useEffect } from "react";
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

  // Function to delete an element and all its children recursively
  const deleteElement = async (elementId: string) => {
    const newElements = [...overlay.elements];
    const elementToDelete = newElements.find((e) => e.id === elementId);

    if (!elementToDelete) return;

    // Find all children of the element to delete
    const findChildren = (parentId: string): string[] => {
      const children = newElements.filter((e) => e.parentId === parentId);
      let allChildren: string[] = [];
      for (const child of children) {
        allChildren.push(child.id);
        allChildren = [...allChildren, ...findChildren(child.id)];
      }
      return allChildren;
    };

    // Get all children IDs to delete
    const childrenIds = findChildren(elementId);
    const allIdsToDelete = [elementId, ...childrenIds];

    // Remove all elements to delete
    const filteredElements = newElements.filter((e) => !allIdsToDelete.includes(e.id));

    // Update the overlay with the filtered elements
    const updatedOverlay = { ...overlay, elements: filteredElements };
    onOverlayChange(updatedOverlay);

    // Persist to backend
    await fetch(`/api/elements/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        elementIds: allIdsToDelete,
        overlayId: overlay.id,
      }),
    }).catch(console.error);
  };

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const target = location.current.dropTargets[0];

        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;

        // Can't drop on yourself
        if (sourceData.id === targetData.id) {
          return;
        }

        const newElements = [...overlay.elements];
        const sourceElement = newElements.find((e) => e.id === sourceData.id);

        if (!sourceElement) {
          return;
        }

        const sourceParentId = sourceData.parentId as string | null;
        const closestEdge = extractClosestEdge(targetData) as Edge | null;

        // Determine the target parent ID based on drop location
        let targetParentId: string | null;
        let isDroppedInsideContainer = false;

        if (targetData.type === ElementTypeEnum.CONTAINER) {
          // Check if we have a closest edge
          if (closestEdge) {
            // Dropped on the edge of a container - treat as sibling
            targetParentId = targetData.parentId as string | null;
          } else {
            // Dropped in the middle/on the container itself - drop inside
            targetParentId = targetData.id as string;
            isDroppedInsideContainer = true;
          }
        } else {
          // Dropped on a regular element - use its parent
          targetParentId = targetData.parentId as string | null;
        }

        // Get source and target lists
        const sourceList = newElements
          .filter((e) => e.parentId === sourceParentId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const targetList = newElements
          .filter((e) => e.parentId === targetParentId)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        const startIndex = sourceList.findIndex((e) => e.id === sourceData.id);

        if (startIndex === -1) {
          return;
        }

        if (sourceParentId === targetParentId) {
          // Reordering within the same parent
          const indexOfTarget = targetList.findIndex((e) => e.id === targetData.id);

          if (indexOfTarget < 0) {
            return;
          }

          const finishIndex = getReorderDestinationIndex({
            startIndex,
            indexOfTarget,
            closestEdgeOfTarget: closestEdge,
            axis: "vertical",
          });

          if (startIndex === finishIndex) {
            return;
          }

          const reorderedList = reorder({
            list: targetList,
            startIndex,
            finishIndex,
          });

          reorderedList.forEach((item, index) => {
            const element = newElements.find((e) => e.id === item.id);
            if (element) {
              element.position = index;
            }
          });
        } else {
          // Moving between different parents
          sourceElement.parentId = targetParentId;

          // Remove from source list
          sourceList.splice(startIndex, 1);
          sourceList.forEach((item, index) => {
            const el = newElements.find((e) => e.id === item.id);
            if (el) {
              el.position = index;
            }
          });

          // Determine insertion index in target list
          let finishIndex: number;

          if (isDroppedInsideContainer) {
            // Dropped inside container - add at the end
            finishIndex = targetList.length;
          } else {
            // Dropped as a sibling - use edge to determine position
            const indexOfTarget = targetList.findIndex((e) => e.id === targetData.id);

            if (indexOfTarget >= 0) {
              // Target found in list
              finishIndex = getReorderDestinationIndex({
                startIndex: -1, // Coming from outside this list
                indexOfTarget,
                closestEdgeOfTarget: closestEdge,
                axis: "vertical",
              });
            } else {
              // Target not in this list (shouldn't happen, but fallback)
              finishIndex = targetList.length;
            }
          }

          // Insert into target list
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

        // Persist to backend
        fetch(`/api/elements/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            elements: newElements,
            overlayId: overlay.id,
          }),
        }).catch(console.error);
      },
    });
  }, [overlay, onOverlayChange]);

  return (
    <div className="relative p-2 space-y-2">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Elements</h3>
        <AddElementModal overlay={overlay} onOverlayChange={onOverlayChange} />
      </div>
      <div className="space-y-2 relative">
        {rootElements.map((element) => (
          <ElementListItem
            key={element.id}
            element={element}
            onOverlayChange={onOverlayChange}
            overlay={overlay}
            onDeleteElement={deleteElement}
            className={element.type === ElementTypeEnum.CONTAINER ? "mb-3" : "mb-1"}
          />
        ))}
      </div>
    </div>
  );
};
