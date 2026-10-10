import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_SCROLLER_HEIGHT,
  DEFAULT_SCROLLER_PAUSE,
  DEFAULT_SCROLLER_SPEED,
  DEFAULT_SCROLLER_WIDTH,
  SCROLLER_PAUSE_RANGE,
  SCROLLER_SPEED_RANGE,
  type PrismaElement,
  type ScrollerMode,
  type ScrollerStyle,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { alignOptions } from "./alignment";
import { ColorInput, PixelInput } from "./appearance";

const DIRECTION_OPTIONS = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
] as const;

const MODE_OPTIONS = [
  { value: "bounce", label: "Back and forth" },
  { value: "loop", label: "Loop" },
] as const;

export const ScrollerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ScrollerStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as ScrollerStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );
  const updateStyle = (patch: Partial<ScrollerStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const vertical = style.direction !== "horizontal";
  const mode: ScrollerMode = style.mode === "loop" ? "loop" : "bounce";
  const id = (name: string) => `${element.id}-scroller-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Lines up the elements inside it and scrolls through them by itself
        once they are longer than the box. It holds still while the Move tool
        (M) is on, so pick hidden children from the element list.
      </p>
      <div className="space-y-2">
        <Label htmlFor={id("direction")}>Direction</Label>
        <SegmentedControl
          id={id("direction")}
          aria-label="Scroll direction"
          value={vertical ? "vertical" : "horizontal"}
          onValueChange={(direction) => updateStyle({ direction })}
          options={DIRECTION_OPTIONS}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("mode")}>Scrolling</Label>
        <SegmentedControl
          id={id("mode")}
          aria-label="Scrolling"
          value={mode}
          onValueChange={(mode) => updateStyle({ mode })}
          options={MODE_OPTIONS}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <BindableField property="style.speed" label="Speed" htmlFor={id("speed")}>
          <NumberField
            id={id("speed")}
            value={style.speed ?? DEFAULT_SCROLLER_SPEED}
            min={SCROLLER_SPEED_RANGE.min}
            max={SCROLLER_SPEED_RANGE.max}
            unit="px/s"
            onChange={(speed) => updateStyle({ speed })}
          />
        </BindableField>
        {mode === "bounce" && (
          <BindableField property="style.pause" label="Pause at Ends" htmlFor={id("pause")}>
            <NumberField
              id={id("pause")}
              value={style.pause ?? DEFAULT_SCROLLER_PAUSE}
              min={SCROLLER_PAUSE_RANGE.min}
              max={SCROLLER_PAUSE_RANGE.max}
              step={0.5}
              unit="s"
              onChange={(pause) => updateStyle({ pause })}
            />
          </BindableField>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PixelInput
          id={id("width")}
          label={vertical ? "Width" : "Max Width"}
          property="style.width"
          min={1}
          value={style.width ?? DEFAULT_SCROLLER_WIDTH}
          onChange={(width) => updateStyle({ width })}
        />
        <PixelInput
          id={id("height")}
          label={vertical ? "Max Height" : "Height"}
          property="style.height"
          min={1}
          value={style.height ?? DEFAULT_SCROLLER_HEIGHT}
          onChange={(height) => updateStyle({ height })}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id={id("fit-content")}
          checked={style.fitContent === true}
          onCheckedChange={(fitContent) => updateStyle({ fitContent })}
        />
        <Label htmlFor={id("fit-content")}>
          Shrink to the content while it fits
        </Label>
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
          value={style.alignItems || "stretch"}
          onValueChange={(v) =>
            updateStyle({ alignItems: v as ScrollerStyle["alignItems"] })
          }
          options={alignOptions(!vertical, { stretch: true }).filter(
            (option) => option.value !== "baseline",
          )}
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
