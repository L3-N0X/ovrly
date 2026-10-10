import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import { type PrismaElement, type TitleStyle } from "@/lib/types";
import { fontWeightOf } from "@/lib/fonts";
import React, { useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { FontWeightPicker } from "../../FontWeightPicker";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
} from "lucide-react";
import { SizeField } from "./appearance";
import { HUG_OR_FILL, sizeModePatch, type SizeMode } from "./sizing";

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
] as const;

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "Top", icon: AlignStartHorizontal },
  { value: "center", label: "Middle", icon: AlignCenterHorizontal },
  { value: "bottom", label: "Bottom", icon: AlignEndHorizontal },
] as const;

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TitleStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as TitleStyle) || {}, [element.style]);
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);

  // Shown on the canvas right away; saving is debounced by the overlay itself.
  const handleStyleChange = (newStyle: Partial<TitleStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const id = (name: string) => `${element.id}-title-${name}`;

  // A title is as big as its text, unless it fills its parent; the text is then aligned in it.
  const sizeMode = (side: "width" | "height"): SizeMode =>
    (side === "width" ? style.fillWidth : style.fillHeight) === true ? "fill" : "hug";
  const setSizeMode = (side: "width" | "height", mode: SizeMode) =>
    handleStyleChange(sizeModePatch(element.id, style, side, mode, 0));

  return (
    <div className="space-y-4">
      <SizeField
        id={id("width")}
        label="Width"
        modes={HUG_OR_FILL}
        mode={sizeMode("width")}
        onModeChange={(mode) => setSizeMode("width", mode)}
      />
      <SizeField
        id={id("height")}
        label="Height"
        modes={HUG_OR_FILL}
        mode={sizeMode("height")}
        onModeChange={(mode) => setSizeMode("height", mode)}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={id("text-align")}>Text Align</Label>
          <SegmentedControl
            id={id("text-align")}
            aria-label="Horizontal text alignment"
            value={style.textAlign ?? "left"}
            onValueChange={(textAlign) => handleStyleChange({ textAlign })}
            options={TEXT_ALIGN_OPTIONS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("vertical-align")}>Vertical Align</Label>
          <SegmentedControl
            id={id("vertical-align")}
            aria-label="Vertical text alignment"
            value={style.verticalAlign ?? "top"}
            onValueChange={(verticalAlign) => handleStyleChange({ verticalAlign })}
            options={VERTICAL_ALIGN_OPTIONS}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            weight={fontWeightOf(style)}
            onChange={(font) => handleStyleChange({ fontFamily: font })}
            className="w-full h-10"
            previewWord={element.title?.text}
          />
        </div>
        <BindableField property="style.fontSize" label="Font Size" htmlFor={id("font-size")}>
          <NumberField
            id={id("font-size")}
            className="h-10"
            value={typeof style?.fontSize === "number" ? style.fontSize : 36}
            min={0}
            unit="px"
            onChange={(fontSize) => handleStyleChange({ fontSize })}
          />
        </BindableField>
        <div className="space-y-2">
          <Label htmlFor={id("font-weight")}>Font Weight</Label>
          <FontWeightPicker
            id={id("font-weight")}
            value={fontWeightOf(style)}
            onChange={(fontWeight) => handleStyleChange({ fontWeight })}
          />
        </div>
        <BindableField property="style.color" label="Color" htmlFor={id("color")}>
          <ColorField
            id={id("color")}
            value={style.color || "#ffffff"}
            onChange={(color) => handleStyleChange({ color })}
            onOpenChange={setIsPickingColor}
          />
        </BindableField>
        <BindableField property="style.paddingX" label="Padding X" htmlFor={id("padding-x")}>
          <NumberField
            id={id("padding-x")}
            value={typeof style?.paddingX === "number" ? style.paddingX : 0}
            min={0}
            unit="px"
            onChange={(paddingX) => handleStyleChange({ paddingX })}
          />
        </BindableField>
        <BindableField property="style.paddingY" label="Padding Y" htmlFor={id("padding-y")}>
          <NumberField
            id={id("padding-y")}
            value={typeof style?.paddingY === "number" ? style.paddingY : 0}
            min={0}
            unit="px"
            onChange={(paddingY) => handleStyleChange({ paddingY })}
          />
        </BindableField>
      </div>
    </div>
  );
};
