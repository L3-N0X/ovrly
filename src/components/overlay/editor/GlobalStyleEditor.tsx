import { SegmentedControl } from "@/components/ui/segmented-control";
import { type PrismaOverlay, type OnOverlayChange } from "@/lib/types";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Scan,
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
import { Field, FieldGrid, InspectorSection, NumberProp } from "./fields";

const DIRECTIONS = [
  { value: "column", label: "Vertical", icon: ArrowDown },
  { value: "row", label: "Horizontal", icon: ArrowRight },
  { value: "column-reverse", label: "Vertical, reversed", icon: ArrowUp },
  { value: "row-reverse", label: "Horizontal, reversed", icon: ArrowLeft },
];

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
    <InspectorSection title="Auto layout">
      <FieldGrid className="items-end">
        <Field label="Direction" htmlFor="global-direction">
          <SegmentedControl
            id="global-direction"
            aria-label="Direction"
            size="sm"
            stretch
            value={globalStyle?.flexDirection || "column"}
            onValueChange={(v) => updateGlobalStyle("flexDirection", v)}
            options={DIRECTIONS}
          />
        </Field>
        <NumberProp
          id="global-gap"
          label="Gap between items"
          prefix={row ? <BetweenVerticalStart /> : <BetweenHorizontalStart />}
          min={0}
          unit="px"
          value={typeof globalStyle?.gap === "number" ? globalStyle.gap : 16}
          onChange={(v) => updateGlobalStyle("gap", v)}
        />
        <NumberProp
          id="global-padding"
          label="Padding"
          prefix={<Scan />}
          min={0}
          unit="px"
          value={typeof globalStyle?.padding === "number" ? globalStyle.padding : 0}
          onChange={(v) => updateGlobalStyle("padding", v)}
        />
      </FieldGrid>
      <Field label="Position on canvas">
        <FieldGrid>
          <SegmentedControl
            aria-label="Horizontal position on the canvas"
            size="sm"
            stretch
            value={globalStyle?.outerJustifyContent || "center"}
            onValueChange={(v) => updateGlobalStyle("outerJustifyContent", v)}
            options={OUTER_HORIZONTAL}
          />
          <SegmentedControl
            aria-label="Vertical position on the canvas"
            size="sm"
            stretch
            value={globalStyle?.outerAlignItems || "center"}
            onValueChange={(v) => updateGlobalStyle("outerAlignItems", v)}
            options={OUTER_VERTICAL}
          />
        </FieldGrid>
      </Field>
      <Field label="Align items">
        <SegmentedControl
          aria-label="Element alignment"
          size="sm"
          stretch
          // Same fallbacks as the canvas.
          value={globalStyle?.innerAlignItems || globalStyle?.alignItems || "center"}
          onValueChange={(v) => updateGlobalStyle("innerAlignItems", v)}
          options={alignOptions(row)}
        />
      </Field>
    </InspectorSection>
  );
};
