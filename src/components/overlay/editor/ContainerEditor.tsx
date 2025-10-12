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
import { type PrismaElement } from "@/lib/types";
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  StretchHorizontal,
} from "lucide-react";
import React from "react";
import { type ContainerStyle } from "../Container";
import { handleValueChange } from "./helper";

export const ContainerStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange }) => {
  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as ContainerStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg mt-2">
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
  );
};
