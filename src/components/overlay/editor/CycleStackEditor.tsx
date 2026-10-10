import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  StretchHorizontal,
  StretchVertical,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  CYCLE_STACK_INTERVAL_RANGE,
  CYCLE_STACK_TRANSITION_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CYCLE_STACK_HEIGHT,
  DEFAULT_CYCLE_STACK_INTERVAL,
  DEFAULT_CYCLE_STACK_TRANSITION_DURATION,
  DEFAULT_CYCLE_STACK_WIDTH,
  type CycleStackStyle,
  type CycleStackTransition,
  type PrismaElement,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { ColorInput, PixelInput } from "./appearance";

const TRANSITION_OPTIONS = [
  { value: "fade", label: "Fade" },
  { value: "none", label: "Cut" },
] as const;

const HORIZONTAL_OPTIONS = [
  { value: "start", label: "Left", icon: AlignStartVertical },
  { value: "center", label: "Center", icon: AlignCenterVertical },
  { value: "end", label: "Right", icon: AlignEndVertical },
  { value: "stretch", label: "Stretch", icon: StretchHorizontal },
] as const;

const VERTICAL_OPTIONS = [
  { value: "start", label: "Top", icon: AlignStartHorizontal },
  { value: "center", label: "Center", icon: AlignCenterHorizontal },
  { value: "end", label: "Bottom", icon: AlignEndHorizontal },
  { value: "stretch", label: "Stretch", icon: StretchVertical },
] as const;

export const CycleStackEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CycleStackStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as CycleStackStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );
  const updateStyle = (patch: Partial<CycleStackStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const transition: CycleStackTransition = style.transition === "none" ? "none" : "fade";
  const fitContent = style.fitContent === true;
  const id = (name: string) => `${element.id}-cycle-stack-${name}`;
  const pixels = (key: "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Puts the elements inside it on top of each other and shows one at a
        time. Selecting a layer (or something in it) shows it here in the
        editor; pause the stack under Content to keep one up in OBS too.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <BindableField property="style.interval" label="Show Each For" htmlFor={id("interval")}>
          <NumberField
            id={id("interval")}
            value={style.interval ?? DEFAULT_CYCLE_STACK_INTERVAL}
            min={CYCLE_STACK_INTERVAL_RANGE.min}
            max={CYCLE_STACK_INTERVAL_RANGE.max}
            step={0.5}
            unit="s"
            onChange={(interval) => updateStyle({ interval })}
          />
        </BindableField>
        {transition === "fade" && (
          <BindableField
            property="style.transitionDuration"
            label="Fade Duration"
            htmlFor={id("transition-duration")}
          >
            <NumberField
              id={id("transition-duration")}
              value={style.transitionDuration ?? DEFAULT_CYCLE_STACK_TRANSITION_DURATION}
              min={CYCLE_STACK_TRANSITION_RANGE.min}
              max={CYCLE_STACK_TRANSITION_RANGE.max}
              step={0.1}
              unit="s"
              onChange={(transitionDuration) => updateStyle({ transitionDuration })}
            />
          </BindableField>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("transition")}>Transition</Label>
        <SegmentedControl
          id={id("transition")}
          aria-label="Transition"
          value={transition}
          onValueChange={(transition) => updateStyle({ transition })}
          options={TRANSITION_OPTIONS}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id={id("fit-content")}
          checked={fitContent}
          onCheckedChange={(fitContent) => updateStyle({ fitContent })}
        />
        <Label htmlFor={id("fit-content")}>Size to the biggest layer</Label>
      </div>
      {!fitContent && (
        <div className="grid grid-cols-2 gap-4">
          <PixelInput
            id={id("width")}
            label="Width"
            property="style.width"
            min={1}
            value={style.width ?? DEFAULT_CYCLE_STACK_WIDTH}
            onChange={(width) => updateStyle({ width })}
          />
          <PixelInput
            id={id("height")}
            label="Height"
            property="style.height"
            min={1}
            value={style.height ?? DEFAULT_CYCLE_STACK_HEIGHT}
            onChange={(height) => updateStyle({ height })}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={id("justify")}>Horizontal Alignment</Label>
        <SegmentedControl
          id={id("justify")}
          aria-label="Horizontal alignment"
          value={style.justifyItems || "center"}
          onValueChange={(justifyItems) => updateStyle({ justifyItems })}
          options={HORIZONTAL_OPTIONS}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("align")}>Vertical Alignment</Label>
        <SegmentedControl
          id={id("align")}
          aria-label="Vertical alignment"
          value={style.alignItems || "center"}
          onValueChange={(alignItems) => updateStyle({ alignItems })}
          options={VERTICAL_OPTIONS}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
