import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type ContainerStyle, type PrismaElement } from "@/lib/types";
import React from "react";
import { handleValueChange } from "./helper";
import { alignOptions, isRowDirection, justifyOptions } from "./alignment";

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange }) => {
  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as ContainerStyle;
  const row = isRowDirection(style.flexDirection);
  const id = (name: string) => `${element.id}-container-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <div className="space-y-4">
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
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor={id("gap")}>Gap</Label>
          <NumberField
            id={id("gap")}
            value={pixels("gap")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle("gap", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("padding-x")}>Padding X</Label>
          <NumberField
            id={id("padding-x")}
            value={pixels("paddingX")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle("paddingX", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("padding-y")}>Padding Y</Label>
          <NumberField
            id={id("padding-y")}
            value={pixels("paddingY")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle("paddingY", v)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("align")}>Align Items</Label>
        <SegmentedControl
          id={id("align")}
          aria-label="Align items"
          value={style?.alignItems || "stretch"}
          onValueChange={(v) => updateStyle("alignItems", v)}
          options={alignOptions(row, { stretch: true })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("justify")}>Justify Content</Label>
        <SegmentedControl
          id={id("justify")}
          aria-label="Justify content"
          value={style?.justifyContent || "flex-start"}
          onValueChange={(v) => updateStyle("justifyContent", v)}
          options={justifyOptions(row)}
        />
      </div>
    </div>
  );
};
