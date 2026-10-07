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
import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  type ContainerStyle,
  type PrismaElement,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { alignOptions, isRowDirection, justifyOptions } from "./alignment";
import { ColorInput, PixelInput } from "./appearance";

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
        <div className="space-y-2">
          <Label htmlFor={id("gap")}>Gap</Label>
          <NumberField
            id={id("gap")}
            value={pixels("gap")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ gap: v })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("padding-x")}>Padding X</Label>
          <NumberField
            id={id("padding-x")}
            value={pixels("paddingX")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ paddingX: v })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("padding-y")}>Padding Y</Label>
          <NumberField
            id={id("padding-y")}
            value={pixels("paddingY")}
            min={0}
            unit="px"
            onChange={(v) => updateStyle({ paddingY: v })}
          />
        </div>
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
          value={style.backgroundColor || ""}
          defaultColor="#000000"
          onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          onClear={() => updateStyle({ backgroundColor: "" })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={id("border-radius")}
          label="Corner Radius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
          onChange={(borderRadius) => updateStyle({ borderRadius })}
        />
        <ColorInput
          id={id("border-color")}
          label="Stroke"
          value={style.borderColor || DEFAULT_BORDER_COLOR}
          defaultColor={DEFAULT_BORDER_COLOR}
          onChange={(borderColor) => updateStyle({ borderColor })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={id("border-width")}
          label="Stroke Width"
          min={BORDER_WIDTH_RANGE.min}
          max={BORDER_WIDTH_RANGE.max}
          value={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
          onChange={(borderWidth) => updateStyle({ borderWidth })}
        />
      </div>
    </div>
  );
};
