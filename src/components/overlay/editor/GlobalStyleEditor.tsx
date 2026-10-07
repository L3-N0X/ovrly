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
import { type PrismaOverlay, type OnOverlayChange } from "@/lib/types";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";
import React from "react";
import { handleValueChange } from "./helper";
import { alignOptions, isRowDirection } from "./alignment";

interface GlobalStyleEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
}

const OUTER_VERTICAL = [
  { value: "flex-start", label: "Top", icon: AlignVerticalJustifyStart },
  { value: "center", label: "Center", icon: AlignVerticalJustifyCenter },
  { value: "flex-end", label: "Bottom", icon: AlignVerticalJustifyEnd },
];

const OUTER_HORIZONTAL = [
  { value: "flex-start", label: "Left", icon: AlignHorizontalJustifyStart },
  { value: "center", label: "Center", icon: AlignHorizontalJustifyCenter },
  { value: "flex-end", label: "Right", icon: AlignHorizontalJustifyEnd },
];

export const GlobalStyleEditor: React.FC<GlobalStyleEditorProps> = ({
  overlay,
  onOverlayChange,
}) => {
  const updateGlobalStyle = (path: string, value: string | number) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const newGlobalStyle = { ...(newOverlay.globalStyle || {}) };

    // Map the old property names to new ones for the update
    let newPropertyPath = path;
    switch (path) {
      case "justifyContent":
        newPropertyPath = "innerJustifyContent";
        break;
      case "alignItems":
        newPropertyPath = "innerAlignItems";
        break;
    }

    // Set only the new property
    handleValueChange(newGlobalStyle, newPropertyPath, value);

    newOverlay.globalStyle = newGlobalStyle;
    onOverlayChange(newOverlay);
  };

  const globalStyle = overlay.globalStyle;
  const row = isRowDirection(globalStyle?.flexDirection);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Arrangement</Label>
        <Select
          value={globalStyle?.flexDirection || "column"}
          onValueChange={(v) => updateGlobalStyle("flexDirection", v)}
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="global-gap">Gap</Label>
          <NumberField
            id="global-gap"
            value={typeof globalStyle?.gap === "number" ? globalStyle.gap : 16}
            min={0}
            unit="px"
            onChange={(v) => updateGlobalStyle("gap", v)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="global-padding">Padding</Label>
          <NumberField
            id="global-padding"
            value={typeof globalStyle?.padding === "number" ? globalStyle.padding : 0}
            min={0}
            unit="px"
            onChange={(v) => updateGlobalStyle("padding", v)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Position on Canvas</Label>
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            aria-label="Horizontal position on the canvas"
            value={globalStyle?.outerJustifyContent || "center"}
            onValueChange={(v) => updateGlobalStyle("outerJustifyContent", v)}
            options={OUTER_HORIZONTAL}
          />
          <SegmentedControl
            aria-label="Vertical position on the canvas"
            value={globalStyle?.outerAlignItems || "center"}
            onValueChange={(v) => updateGlobalStyle("outerAlignItems", v)}
            options={OUTER_VERTICAL}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Element Alignment</Label>
        <SegmentedControl
          aria-label="Element alignment"
          // Same fallbacks as the canvas.
          value={globalStyle?.innerAlignItems || globalStyle?.alignItems || "center"}
          onValueChange={(v) => updateGlobalStyle("innerAlignItems", v)}
          options={alignOptions(row)}
        />
      </div>
    </div>
  );
};
