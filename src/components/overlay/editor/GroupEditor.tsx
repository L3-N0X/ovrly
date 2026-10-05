import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  type GroupStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import { useSliderValue } from "@/lib/hooks/useSliderValue";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { ChildList } from "./elementlist/ChildList";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { RenameElementModal } from "./RenameElementModal";

// Whole pixels only; an empty or invalid field leaves the value untouched.
const PixelInput: React.FC<{
  id: string;
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}> = ({ id, label, value, min = 0, onChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      type="number"
      min={min}
      value={value}
      onChange={(e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) onChange(Math.max(min, val));
      }}
      className="h-10"
    />
  </div>
);

// X/Y of an element that sits directly inside a group, for placing it precisely.
export const GroupPositionEditor: React.FC<{
  element: PrismaElement;
  onChange: (position: { x: number; y: number }) => void;
}> = ({ element, onChange }) => {
  const style = (element.style || {}) as GroupStyle;
  const x = style.x ?? 0;
  const y = style.y ?? 0;
  return (
    <div className="grid grid-cols-2 gap-4 p-4 mb-2 border rounded-lg">
      <PixelInput id={`${element.id}-x`} label="X" value={x} onChange={(x) => onChange({ x, y })} />
      <PixelInput id={`${element.id}-y`} label="Y" value={y} onChange={(y) => onChange({ x, y })} />
    </div>
  );
};

export const GroupEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (newOverlay: PrismaOverlay) => void;
  onChange: (newStyle: GroupStyle) => void;
  onDelete?: () => void;
  // Passed down so nested elements can be deleted too.
  onDeleteElement?: (elementId: string) => void;
}> = ({ element, onChange, overlay, onOverlayChange, onDelete, onDeleteElement }) => {
  const style = (element.style || {}) as GroupStyle;
  const updateStyle = (patch: Partial<GroupStyle>) => onChange({ ...style, ...patch });

  const [editorExpanded, setEditorExpanded] = useState(false);
  const radiusSlider = useSliderValue(typeof style.radius === "number" ? style.radius : 0, {
    onCommit: (v) => updateStyle({ radius: v }),
  });

  return (
    <div className="space-y-2 p-2 border rounded-lg">
      <p className="text-sm text-muted-foreground px-1">
        Elements in a group are placed freely. Turn on "Move elements" in the preview to drag
        them into position.
      </p>
      <ChildList
        element={element}
        overlay={overlay}
        onOverlayChange={onOverlayChange}
        onDeleteElement={onDeleteElement}
      />
      <div
        className="text-sm text-primary w-full text-center cursor-pointer select-none hover:bg-accent/50 p-2 rounded-lg"
        onClick={() => setEditorExpanded(!editorExpanded)}
      >
        {editorExpanded ? "Hide" : "Show"} Group Settings
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
            <div className="flex items-center">
              <RenameElementModal
                element={element}
                overlay={overlay}
                onOverlayChange={onOverlayChange}
              >
                <Button variant="ghost" size="icon-lg">
                  <Pencil />
                </Button>
              </RenameElementModal>
              <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
                <Trash2 />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PixelInput
              id={`${element.id}-width`}
              label="Width"
              min={1}
              value={style.width ?? DEFAULT_GROUP_WIDTH}
              onChange={(width) => updateStyle({ width })}
            />
            <PixelInput
              id={`${element.id}-height`}
              label="Height"
              min={1}
              value={style.height ?? DEFAULT_GROUP_HEIGHT}
              onChange={(height) => updateStyle({ height })}
            />
          </div>
          <div className="space-y-2">
            <Label>Background</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-full h-10 rounded-md border"
                    style={{ backgroundColor: style.backgroundColor || "transparent" }}
                  />
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <ColorPickerEditor
                    value={style.backgroundColor || "#00000000"}
                    onChange={(c) => updateStyle({ backgroundColor: c })}
                  />
                </PopoverContent>
              </Popover>
              {style.backgroundColor && (
                // Style updates are merged on the server, so an omitted key wouldn't clear it.
                <Button variant="outline" onClick={() => updateStyle({ backgroundColor: "" })}>
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Corner Radius</Label>
            <div className="flex gap-4">
              <Slider
                value={[radiusSlider.value]}
                onValueChange={([v]) => radiusSlider.onChange(v)}
                onPointerDown={radiusSlider.onInteractionStart}
                onValueCommit={radiusSlider.onInteractionEnd}
                max={200}
                min={0}
              />
              <Input
                value={radiusSlider.value}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  radiusSlider.onChange(isNaN(val) ? 0 : val);
                }}
                onBlur={() => radiusSlider.onInteractionEnd()}
                className="h-10 w-20"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
