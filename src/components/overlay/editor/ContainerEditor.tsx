import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { CANVAS_ELEMENT_ATTRIBUTE } from "../canvasSelection";
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

  const autoWidth = style.autoWidth !== false;
  const autoHeight = style.autoHeight !== false;

  // Switching an automatic side off keeps the size the container has right now.
  const setAuto = (side: "width" | "height", auto: boolean) => {
    const key = side === "width" ? "autoWidth" : "autoHeight";
    if (auto) return updateStyle({ [key]: true });
    const box = document.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(element.id)}"]`)
      ?.firstElementChild as HTMLElement | null | undefined;
    const measured = side === "width" ? box?.offsetWidth : box?.offsetHeight;
    updateStyle({
      [key]: false,
      [side]:
        style[side] ??
        (measured || (side === "width" ? DEFAULT_CONTAINER_WIDTH : DEFAULT_CONTAINER_HEIGHT)),
    });
  };

  const row = isRowDirection(style.flexDirection);
  const id = (name: string) => `${element.id}-container-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={id("auto-width")}
              checked={autoWidth}
              onCheckedChange={(auto) => setAuto("width", auto)}
            />
            <Label htmlFor={id("auto-width")}>Auto width</Label>
          </div>
          {!autoWidth && (
            <PixelInput
              id={id("width")}
              label="Width"
              property="style.width"
              min={1}
              value={style.width ?? DEFAULT_CONTAINER_WIDTH}
              onChange={(width) => updateStyle({ width })}
            />
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id={id("auto-height")}
              checked={autoHeight}
              onCheckedChange={(auto) => setAuto("height", auto)}
            />
            <Label htmlFor={id("auto-height")}>Auto height</Label>
          </div>
          {!autoHeight && (
            <PixelInput
              id={id("height")}
              label="Height"
              property="style.height"
              min={1}
              value={style.height ?? DEFAULT_CONTAINER_HEIGHT}
              onChange={(height) => updateStyle({ height })}
            />
          )}
        </div>
      </div>
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
