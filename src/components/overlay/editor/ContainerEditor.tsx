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
  Pencil,
  StretchHorizontal,
  Trash2,
} from "lucide-react";
import React from "react";
import { handleValueChange } from "./helper";
import { useSliderValue } from "@/lib/hooks/useSliderValue";
import { RenameElementModal } from "./RenameElementModal";

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  overlay: PrismaOverlay;
  onOverlayChange: (newOverlay: PrismaOverlay) => void;
  onChange: (newStyle: ContainerStyle) => void;
  onDelete?: () => void;
}> = ({ element, onChange, overlay, onOverlayChange, onDelete }) => {
  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as ContainerStyle;
  // Local slider state keeps dragging responsive; the style is committed on release
  const gapSlider = useSliderValue(
    typeof style?.gap === "number" ? style.gap : 0,
    { onCommit: (v) => updateStyle("gap", v) }
  );
  const paddingXSlider = useSliderValue(
    typeof style?.paddingX === "number" ? style.paddingX : 0,
    { onCommit: (v) => updateStyle("paddingX", v) }
  );
  const paddingYSlider = useSliderValue(
    typeof style?.paddingY === "number" ? style.paddingY : 0,
    { onCommit: (v) => updateStyle("paddingY", v) }
  );


  return (
    <div className="space-y-4 p-4 border rounded-lg">
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
            value={[gapSlider.value]}
            onValueChange={(v) => {
              const val = v[0];
              gapSlider.onChange(val);
            }}
            onPointerDown={gapSlider.onInteractionStart}
            onValueCommit={gapSlider.onInteractionEnd}
            max={200}
            min={0}
          />
          <Input
            value={gapSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                gapSlider.onChange(0);
                updateStyle("gap", 0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                gapSlider.onChange(val);
                updateStyle("gap", val);
              }
            }}
            onBlur={() => gapSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Padding X</Label>
        <div className="flex gap-4">
          <Slider
            value={[paddingXSlider.value]}
            onValueChange={(v) => {
              const val = v[0];
              paddingXSlider.onChange(val);
            }}
            onPointerDown={paddingXSlider.onInteractionStart}
            onValueCommit={paddingXSlider.onInteractionEnd}
            max={300}
            min={0}
          />
          <Input
            value={paddingXSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                paddingXSlider.onChange(0);
                updateStyle("paddingX", 0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                paddingXSlider.onChange(val);
                updateStyle("paddingX", val);
              }
            }}
            onBlur={() => paddingXSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Padding Y</Label>
        <div className="flex gap-4">
          <Slider
            value={[paddingYSlider.value]}
            onValueChange={(v) => {
              const val = v[0];
              paddingYSlider.onChange(val);
            }}
            onPointerDown={paddingYSlider.onInteractionStart}
            onValueCommit={paddingYSlider.onInteractionEnd}
            max={300}
            min={0}
          />
          <Input
            value={paddingYSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                paddingYSlider.onChange(0);
                updateStyle("paddingY", 0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                paddingYSlider.onChange(val);
                updateStyle("paddingY", val);
              }
            }}
            onBlur={() => paddingYSlider.onInteractionEnd()}
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
  );
};
