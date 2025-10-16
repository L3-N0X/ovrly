import { Chip } from "@/components/ui/Chip";
import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { ContainerEditor } from "../ContainerEditor";
import { CounterStyleEditor } from "../CounterEditor";
import { TimerStyleEditor } from "../TimerEditor";
import ImageStyleEditor from "../ImageStyleEditor";
import { TitleStyleEditor } from "../TitleEditor";
import { DragPreview } from "./DragPreview";
import type { ImageStyle } from "@/lib/types";

export const ElementListItem = ({
  element,
  onOverlayChange,
  overlay,
  onDeleteElement,
  className = "",
}: {
  element: PrismaElement;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  overlay: PrismaOverlay;
  onDeleteElement?: (elementId: string) => void;
  className?: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);
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
        getInitialData: () => ({
          id: element.id,
          parentId: element.parentId,
          type: element.type,
        }),
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
        },
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          // Can't drop on yourself
          if (source.data.id === element.id) {
            return false;
          }

          // Prevent dropping a parent into its own child
          if (element.type === ElementTypeEnum.CONTAINER) {
            const sourceId = source.data.id as string;
            let currentParentId = element.parentId;

            while (currentParentId) {
              if (currentParentId === sourceId) {
                return false;
              }
              const parent = overlay.elements.find((e) => e.id === currentParentId);
              currentParentId = parent?.parentId || null;
            }
          }

          return true;
        },
        getData: ({ input, element: targetElement }) => {
          const data = {
            id: element.id,
            parentId: element.parentId,
            type: element.type,
          };

          // For containers, attach closest edge to allow dropping as sibling
          return attachClosestEdge(data, {
            input,
            element: targetElement,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter: ({ self, source }) => {
          if (source.data.id === element.id) {
            return;
          }

          const edge = extractClosestEdge(self.data);
          setClosestEdge(edge);
        },
        onDrag: ({ self, source }) => {
          if (source.data.id === element.id) {
            return;
          }

          const edge = extractClosestEdge(self.data);

          // Hide indicator for adjacent items in reorder scenarios
          if (source.data.parentId === element.parentId) {
            const siblings = overlay.elements
              .filter((e) => e.parentId === element.parentId)
              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

            const sourceIndex = siblings.findIndex((e) => e.id === source.data.id);
            const targetIndex = siblings.findIndex((e) => e.id === element.id);

            // Hide if dragging over immediate neighbors in the wrong direction
            if (
              (sourceIndex === targetIndex - 1 && edge === "bottom") ||
              (sourceIndex === targetIndex + 1 && edge === "top")
            ) {
              setClosestEdge(null);
              return;
            }
          }

          setClosestEdge(edge);
        },
        onDragLeave: () => {
          setClosestEdge(null);
        },
        onDrop: () => {
          setClosestEdge(null);
        },
      })
    );
  }, [element, overlay, expanded]);

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
      }).catch(console.error);
    }
  };

  return (
    <div
      ref={ref}
      style={{ opacity: dragging ? 0.4 : 1, position: "relative" }}
      className={className}
    >
      {closestEdge && (
        <div
          style={{
            position: "absolute",
            top: closestEdge === "top" ? -2 : undefined,
            bottom: closestEdge === "bottom" ? -2 : undefined,
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: "#388bff",
            boxShadow: "0 0 0 1px #388bff",
            zIndex: 50,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        className={`flex p-3 gap-3 rounded-md items-center ${
          !dragging && "hover:cursor-pointer hover:bg-accent"
        } ${expanded ? "bg-muted" : ""}`}
      >
        <div ref={dragHandleRef} className="cursor-grab active:cursor-grabbing">
          <GripVertical />
        </div>
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center w-full justify-between cursor-pointer"
        >
          <span className="text-lg font-medium">{element.name}</span>
          <Chip
            className={
              "ml-1 text-xs text-muted-foreground" +
              (element.type === ElementTypeEnum.CONTAINER
                ? " bg-blue-950 text-white border-blue-800"
                : "bg-muted border-border")
            }
          >
            {element.type}
          </Chip>
        </div>
        {expanded ? (
          <ChevronDown className="h-6 w-6 mr-1 cursor-pointer" onClick={() => setExpanded(false)} />
        ) : (
          <ChevronRight className="h-6 w-6 mr-1 cursor-pointer" onClick={() => setExpanded(true)} />
        )}
      </div>
      {expanded && (
        <div className="animate-fadeIn overflow-hidden mt-2">
          {element.type === ElementTypeEnum.TITLE && (
            <TitleStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
              onDelete={() => onDeleteElement?.(element.id)}
            />
          )}
          {element.type === ElementTypeEnum.COUNTER && (
            <CounterStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
              onDelete={() => onDeleteElement?.(element.id)}
            />
          )}
          {element.type === ElementTypeEnum.TIMER && (
            <TimerStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
              onDelete={() => onDeleteElement?.(element.id)}
            />
          )}
          {element.type === ElementTypeEnum.IMAGE && (
            <ImageStyleEditor
              element={element}
              onChange={(style) => updateElementStyle(element.id, style)}
              onDelete={() => onDeleteElement?.(element.id)}
            />
          )}
          {element.type === ElementTypeEnum.CONTAINER && (
            <ContainerEditor
              element={element}
              overlay={overlay}
              onOverlayChange={onOverlayChange}
              onChange={(style) => updateElementStyle(element.id, style)}
              onDelete={() => onDeleteElement?.(element.id)}
            />
          )}
        </div>
      )}
    </div>
  );
};
