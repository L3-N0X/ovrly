import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type PrismaElement, type PrismaOverlay } from "@/lib/types";
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  StretchHorizontal,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { type ContainerStyle } from "@/lib/types";
import { handleValueChange } from "./helper";
import {
  attachClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { ElementListItem } from "./elementlist/ElementListItem";

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (newOverlay: PrismaOverlay) => void;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange, overlay, onOverlayChange }) => {
  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as ContainerStyle;
  const children = overlay.elements
    .filter((e) => e.parentId === element.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const ref = useRef(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    console.log("ElementListItem closestEdge changed:", closestEdge);
  }, [closestEdge]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return combine(
      dropTargetForElements({
        element: el,
        canDrop: (args) => {
          // Only allow dropping if the source element is not the container itself
          // and if the source element is coming from outside the container (to add to container)
          // or if both source and target are from the same parent (for reordering within container)
          const containerId = element.id;

          // If source is the container itself, don't allow
          if (args.source.data.id === containerId) return false;

          // If source comes from outside the container, allow to add to container
          if (args.source.data.parentId !== containerId) return true;

          // If source comes from inside the container, we'll allow it for reordering
          // but the actual logic for moving out should be handled by the main list
          return true;
        },
        getData: ({ input, element: targetElement }) => {
          const data = { id: element.id, type: element.type, containerId: element.id };
          return attachClosestEdge(data, {
            input,
            element: targetElement,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDragEnter: (args) => {
          // Only set closest edge if the source is not from the same container
          // This prevents the container from intercepting drops meant for the parent list
          const containerId = element.id;

          if (args.source.data.id === containerId) return;

          // If the source is from inside this container, we might want to allow
          // the parent list to handle the drop instead
          setClosestEdge(args.self.data.closestEdge as Edge);
        },
        onDrag: (args) => {
          const containerId = element.id;

          if (args.source.data.id === containerId) return;

          setClosestEdge(args.self.data.closestEdge as Edge);
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => {
          // After drop, check if the element should stay in container or move out
          // This is handled by the main drop monitor, so we just clean up state
          setClosestEdge(null);
        },
      })
    );
  }, [element.id, element.type]);
  return (
    <div className="space-y-4 p-2 border rounded-lg mt-2">
      <div ref={ref} className="p-2 bg-muted/50 rounded-lg space-y-2 min-h-[50px] relative">
        {children.map((child) => (
          <ElementListItem
            key={child.id}
            element={child}
            overlay={overlay}
            onOverlayChange={onOverlayChange}
          />
        ))}
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
      </div>
      <div className="p-2 mt-2 space-y-4">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <div className="space-y-2">
          <Label>Direction</Label>
          <Select
            value={style?.flexDirection || "column"}
            onValueChange={(v) => updateStyle("flexDirection", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="column">Column</SelectItem>
              <SelectItem value="row">Row</SelectItem>
              <SelectItem value="column-reverse">Column Reversed</SelectItem>
              <SelectItem value="row-reverse">Row Reversed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Gap</Label>
          <div className="flex gap-4">
            <Slider
              value={[typeof style?.gap === "number" ? style.gap : 0]}
              onValueChange={(v) => updateStyle("gap", v[0])}
              max={200}
              min={0}
            />
            <Input
              value={typeof style?.gap === "number" ? style.gap : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("gap", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("gap", val);
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Padding X</Label>
          <div className="flex gap-4">
            <Slider
              value={[typeof style?.paddingX === "number" ? style.paddingX : 0]}
              onValueChange={(v) => updateStyle("paddingX", v[0])}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.paddingX === "number" ? style.paddingX : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("paddingX", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("paddingX", val);
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Padding Y</Label>
          <div className="flex gap-4">
            <Slider
              value={[typeof style?.paddingY === "number" ? style.paddingY : 0]}
              onValueChange={(v) => updateStyle("paddingY", v[0])}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.paddingY === "number" ? style.paddingY : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("paddingY", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("paddingY", val);
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Align Items</Label>
          <ToggleGroup
            type="single"
            value={style?.alignItems || "stretch"}
            onValueChange={(v) => v && updateStyle("alignItems", v)}
            className="w-full"
            variant="outline"
          >
            <ToggleGroupItem value="flex-start" className="w-full">
              <AlignVerticalJustifyStart className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="center" className="w-full">
              <AlignVerticalJustifyCenter className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="flex-end" className="w-full">
              <AlignVerticalJustifyEnd className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="stretch" className="w-full">
              <StretchHorizontal className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="baseline" className="w-full">
              <Baseline className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <Label>Justify Content</Label>
          <Select
            value={style?.justifyContent || "flex-start"}
            onValueChange={(v) => updateStyle("justifyContent", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flex-start">Start</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="flex-end">End</SelectItem>
              <SelectItem value="space-between">Space Between</SelectItem>
              <SelectItem value="space-around">Space Around</SelectItem>
              <SelectItem value="space-evenly">Space Evenly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
