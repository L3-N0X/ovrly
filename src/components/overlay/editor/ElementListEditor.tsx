import { Chip } from "@/components/ui/Chip";
import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { ContainerEditor } from "./ContainerEditor";
import { CounterStyleEditor } from "./CounterEditor";
import { TitleStyleEditor } from "./TitleEditor";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {
  attachClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { AddElementModal } from "./AddElementModal";

interface ElementListEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

const DragPreview = ({ element }: { element: PrismaElement }) => {
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        color: "white",
        padding: "12px",
        borderRadius: "0.375rem",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        width: "350px",
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      }}
    >
      <GripVertical color="#a1a1aa" />
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: "500", fontSize: "1rem" }}>{element.name}</span>
        <span
          style={{
            fontSize: "0.75rem",
            color: "#a1a1aa",
            backgroundColor: "#27272a",
            padding: "2px 8px",
            borderRadius: "9999px",
            textTransform: "uppercase",
            fontWeight: "bold",
          }}
        >
          {element.type}
        </span>
      </div>
    </div>
  );
};

export const ElementListItem = ({
  element,
  onOverlayChange,
  overlay,
}: {
  element: PrismaElement;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  overlay: PrismaOverlay;
}) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);
  const dragHandleRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = ref.current;
    const handle = dragHandleRef.current;
    if (!el || !handle) return;

    return combine(
      draggable({
        element: el,
        dragHandle: handle,
        getInitialData: () => ({ id: element.id, parentId: element.parentId, type: element.type }),
        onGenerateDragPreview: ({ nativeSetDragImage, source, location }) => {
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element: source.element,
              input: location.current.input,
            }),
            render: ({ container }) => {
              const root = ReactDOM.createRoot(container);
              root.render(<DragPreview element={element} />);
              return () => root.unmount();
            },
          });
        },
        onDragStart: () => setDragging(true),
        onDrop: () => {
          setDragging(false);
          setClosestEdge(null);
        },
      }),
      dropTargetForElements({
        element: el,
        getData: ({ input, element: targetElement }) => {
          const data = { id: element.id, parentId: element.parentId, type: element.type };
          return attachClosestEdge(data, {
            input,
            element: targetElement,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter: (args) => setClosestEdge(args.self.data.closestEdge as Edge),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      })
    );
  }, [element, onOverlayChange, overlay, expanded]);

  const updateElementStyle = async (elementId: string, newStyle: ElementStyle) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementIndex = newOverlay.elements.findIndex((el: PrismaElement) => el.id === elementId);
    if (elementIndex > -1) {
      newOverlay.elements[elementIndex].style = newStyle;
      onOverlayChange(newOverlay);

      await fetch(`/api/elements/${elementId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ style: newStyle }),
      });
    }
  };

  return (
    <div ref={ref} style={{ opacity: dragging ? 0.4 : 1, position: "relative" }}>
      {closestEdge && (
        <div
          style={{
            position: "absolute",
            [closestEdge]: -2,
            left: 0,
            right: 0,
            height: 4,
            background: "blue",
          }}
        />
      )}
      <div
        className={`flex p-3 gap-3 rounded-md items-center ${
          !dragging && "hover:cursor-pointer hover:bg-accent"
        } ${expanded ? "bg-muted" : ""}`}
      >
        <div ref={dragHandleRef} className="cursor-grab">
          <GripVertical />
        </div>
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center w-full justify-between cursor-pointer"
        >
          <span className="text-lg font-medium">{element.name}</span>
          <Chip className="ml-1 text-xs text-muted-foreground">{element.type}</Chip>
        </div>
        {expanded ? (
          <ChevronDown className="h-6 w-6 mr-1 cursor-pointer" onClick={() => setExpanded(false)} />
        ) : (
          <ChevronRight className="h-6 w-6 mr-1 cursor-pointer" onClick={() => setExpanded(true)} />
        )}
      </div>
      {expanded && (
        <div className="animate-fadeIn overflow-hidden">
          {element.type === ElementTypeEnum.TITLE && (
            <TitleStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
            />
          )}
          {element.type === ElementTypeEnum.COUNTER && (
            <CounterStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
            />
          )}
          {element.type === ElementTypeEnum.CONTAINER && (
            <ContainerEditor
              element={element}
              overlay={overlay}
              onOverlayChange={onOverlayChange}
              onChange={(style) => updateElementStyle(element.id, style)}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const ElementListEditor: React.FC<ElementListEditorProps> = ({
  overlay,
  onOverlayChange,
}) => {
  const rootElements = overlay.elements
    .filter((element) => !element.parentId)
    .sort((a, b) => a.position - b.position);
  const ref = useRef(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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
        onDragEnter: (args) => setClosestEdge(args.self.data.closestEdge as Edge),
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      })
    );
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const target = location.current.dropTargets[0];
        if (!target) {
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
          .sort((a, b) => a.position - b.position);
        const startIndex = sourceList.findIndex((e) => e.id === sourceData.id);

        let targetParentId: string | null;
        if (targetData.type === ElementTypeEnum.CONTAINER) {
          targetParentId = targetData.id as string;
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
            .sort((a, b) => a.position - b.position);

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
            // Dropped on a container
            const closestEdge = target.data.closestEdge as Edge | null;
            if (closestEdge === "bottom") {
              finishIndex = targetList.length;
            } else {
              // 'top' or null
              finishIndex = 0;
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
    <div ref={ref}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Elements</h3>
        <AddElementModal overlay={overlay} onOverlayChange={onOverlayChange} />
      </div>
      <div className="space-y-2">
        {rootElements.map((element) => (
          <ElementListItem
            key={element.id}
            element={element}
            onOverlayChange={onOverlayChange}
            overlay={overlay}
          />
        ))}
      </div>
    </div>
  );
};
