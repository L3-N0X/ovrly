import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTAINER_HEIGHT,
  DEFAULT_CONTAINER_WIDTH,
  type ContainerStyle,
  type PrismaElement,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { alignOptions, isRowDirection, justifyOptions } from "./alignment";
import { ColorInput, PixelInput, SizeField } from "./appearance";
import { sizeModePatch, type SizeMode } from "./sizing";

const SIZE_MODES = ["fixed", "hug", "fill"] as const;

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as ContainerStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );

  const updateStyle = (patch: Partial<ContainerStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const sizeMode = (side: "width" | "height"): SizeMode => {
    if ((side === "width" ? style.fillWidth : style.fillHeight) === true) return "fill";
    return (side === "width" ? style.autoWidth : style.autoHeight) === true ? "hug" : "fixed";
  };
  const setSizeMode = (side: "width" | "height", mode: SizeMode) =>
    updateStyle(
      sizeModePatch(
        element.id,
        style,
        side,
        mode,
        side === "width" ? DEFAULT_CONTAINER_WIDTH : DEFAULT_CONTAINER_HEIGHT,
        side === "width" ? "autoWidth" : "autoHeight",
      ),
    );

  const row = isRowDirection(style.flexDirection);
  const id = (name: string) => `${element.id}-container-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <div className="space-y-4">
      <SizeField
        id={id("width")}
        label="Width"
        property="style.width"
        modes={SIZE_MODES}
        mode={sizeMode("width")}
        onModeChange={(mode) => setSizeMode("width", mode)}
        min={1}
        value={style.width ?? DEFAULT_CONTAINER_WIDTH}
        onChange={(width) => updateStyle({ width })}
      />
      <SizeField
        id={id("height")}
        label="Height"
        property="style.height"
        modes={SIZE_MODES}
        mode={sizeMode("height")}
        onModeChange={(mode) => setSizeMode("height", mode)}
        min={1}
        value={style.height ?? DEFAULT_CONTAINER_HEIGHT}
        onChange={(height) => updateStyle({ height })}
      />
      <div className="space-y-2">
        <Label>Direction</Label>
        <Select
          value={style?.flexDirection || "column"}
          onValueChange={(v) =>
            updateStyle({ flexDirection: v as ContainerStyle["flexDirection"] })
          }
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
        <BindableField property="style.gap" label="Gap" htmlFor={id("gap")}>
          <NumberField
            id={id("gap")}
            value={pixels("gap")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ gap: v })}
          />
        </BindableField>
        <BindableField property="style.paddingX" label="Padding X" htmlFor={id("padding-x")}>
          <NumberField
            id={id("padding-x")}
            value={pixels("paddingX")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ paddingX: v })}
          />
        </BindableField>
        <BindableField property="style.paddingY" label="Padding Y" htmlFor={id("padding-y")}>
          <NumberField
            id={id("padding-y")}
            value={pixels("paddingY")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ paddingY: v })}
          />
        </BindableField>
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("align")}>Align Items</Label>
        <SegmentedControl
          id={id("align")}
          aria-label="Align items"
          value={style?.alignItems || "stretch"}
          onValueChange={(v) =>
            updateStyle({ alignItems: v as ContainerStyle["alignItems"] })
          }
          options={alignOptions(row, { stretch: true })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("justify")}>Justify Content</Label>
        <SegmentedControl
          id={id("justify")}
          aria-label="Justify content"
          value={style?.justifyContent || "flex-start"}
          onValueChange={(v) =>
            updateStyle({
              justifyContent: v as ContainerStyle["justifyContent"],
            })
          }
          options={justifyOptions(row)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorInput
          id={id("background")}
          label="Background"
          property="style.backgroundColor"
          value={style.backgroundColor || ""}
          defaultColor="#000000"
          onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          onClear={() => updateStyle({ backgroundColor: "" })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={id("border-radius")}
          label="Corner Radius"
          property="style.borderRadius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
          onChange={(borderRadius) => updateStyle({ borderRadius })}
        />
        <ColorInput
          id={id("border-color")}
          label="Stroke"
          property="style.borderColor"
          value={style.borderColor || DEFAULT_BORDER_COLOR}
          defaultColor={DEFAULT_BORDER_COLOR}
          onChange={(borderColor) => updateStyle({ borderColor })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={id("border-width")}
          label="Stroke Width"
          property="style.borderWidth"
          min={BORDER_WIDTH_RANGE.min}
          max={BORDER_WIDTH_RANGE.max}
          value={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
          onChange={(borderWidth) => updateStyle({ borderWidth })}
        />
      </div>
    </div>
  );
};
