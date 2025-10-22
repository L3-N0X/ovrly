import { Button } from "@/components/ui/button";
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
import { type ContainerStyle, type PrismaElement, type PrismaOverlay } from "@/lib/types";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  AlignHorizontalDistributeCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  ChevronDown,
  ChevronRight,
  StretchHorizontal,
  Trash2,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ElementListItem } from "./elementlist/ElementListItem";
import { handleValueChange } from "./helper";

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (newOverlay: PrismaOverlay) => void;
  onChange: (newStyle: ContainerStyle) => void;
  onDelete?: () => void;
  ws: WebSocket | null;
}> = ({ element, onChange, overlay, onOverlayChange, onDelete, ws }) => {
  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as ContainerStyle;
  const children = overlay.elements
    .filter((e) => e.parentId === element.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    return combine(
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => {
          // Don't allow dropping the container on itself
          return source.data.id !== element.id;
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
    <div className="space-y-2 p-2 border rounded-lg">
      <div
        ref={containerRef}
        className={`p-2 rounded-lg space-y-2 min-h-[80px] relative transition-colors ${
          isDraggedOver ? "bg-blue-500/20 border-2 border-blue-500 border-dashed" : "bg-muted/50"
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
            ws={ws}
          />
        ))}
      </div>
      <div
        className="text-sm text-primary w-full text-center cursor-pointer select-none hover:bg-accent/50 p-2 rounded-lg"
        onClick={() => setEditorExpanded(!editorExpanded)}
      >
        {editorExpanded ? "Hide" : "Show"} Container Settings
        {editorExpanded ? (
          <ChevronDown className="h-4 w-4 inline-block ml-1 mb-1" />
        ) : (
          <ChevronRight className="h-4 w-4 inline-block ml-1 mb-1" />
        )}
      </div>
      {editorExpanded && (
        <div className="p-2 mt-2 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold">Edit: {element.name}</h4>
            <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
              <Trash2 />
            </Button>
          </div>
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
            <ToggleGroup
              type="single"
              value={style?.justifyContent || "flex-start"}
              onValueChange={(v) => v && updateStyle("justifyContent", v)}
              className="w-full"
              variant="outline"
            >
              <ToggleGroupItem value="flex-start" className="w-full">
                <AlignHorizontalJustifyStart className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="center" className="w-full">
                <AlignHorizontalJustifyCenter className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="flex-end" className="w-full">
                <AlignHorizontalJustifyEnd className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="space-between" className="w-full">
                <AlignHorizontalSpaceBetween className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="space-around" className="w-full">
                <AlignHorizontalSpaceAround className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="space-evenly" className="w-full">
                <AlignHorizontalDistributeCenter className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      )}
    </div>
  );
};
