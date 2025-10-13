import { Chip } from "@/components/ui/Chip";
import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import {
  attachClosestEdge,
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
import { TitleStyleEditor } from "../TitleEditor";
import { DragPreview } from "./DragPreview";

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
