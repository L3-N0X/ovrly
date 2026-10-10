import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_PROGRESS_BACKGROUND,
  DEFAULT_PROGRESS_FILL,
  DEFAULT_PROGRESS_HEIGHT,
  DEFAULT_PROGRESS_RADIUS,
  DEFAULT_PROGRESS_WIDTH,
  type PrismaElement,
  type ProgressMode,
  type ProgressStyle,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { progressMode } from "@/lib/progress";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import React, { useMemo, useState } from "react";
import { ColorInput, PixelInput } from "./appearance";

export const ProgressEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ProgressStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as ProgressStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );
  const updateStyle = (patch: Partial<ProgressStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Reads</Label>
        <SegmentedControl<ProgressMode>
          aria-label="How the value is read"
          value={progressMode(style)}
          onValueChange={(mode) => updateStyle({ mode })}
          options={[
            { value: "percent", label: "Percentage" },
            { value: "values", label: "Value of max" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          {progressMode(style) === "percent"
            ? "The value is a percentage from 0 to 100."
            : "The bar is filled to the value out of the maximum, like a song's progress out of its length."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PixelInput
          id={`${element.id}-width`}
          label="Width"
          property="style.width"
          min={1}
          value={style.width ?? DEFAULT_PROGRESS_WIDTH}
          onChange={(width) => updateStyle({ width })}
        />
        <PixelInput
          id={`${element.id}-height`}
          label="Height"
          property="style.height"
          min={1}
          value={style.height ?? DEFAULT_PROGRESS_HEIGHT}
          onChange={(height) => updateStyle({ height })}
        />
        <ColorInput
          id={`${element.id}-fill`}
          label="Fill"
          property="style.fillColor"
          value={style.fillColor || DEFAULT_PROGRESS_FILL}
          defaultColor={DEFAULT_PROGRESS_FILL}
          onChange={(fillColor) => updateStyle({ fillColor })}
          onOpenChange={setIsPickingColor}
        />
        <ColorInput
          id={`${element.id}-background`}
          label="Track"
          property="style.backgroundColor"
          value={style.backgroundColor || DEFAULT_PROGRESS_BACKGROUND}
          defaultColor={DEFAULT_PROGRESS_BACKGROUND}
          onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={`${element.id}-radius`}
          label="Corner Radius"
          property="style.borderRadius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.borderRadius ?? DEFAULT_PROGRESS_RADIUS}
          onChange={(borderRadius) => updateStyle({ borderRadius })}
        />
        <div />
        <ColorInput
          id={`${element.id}-border-color`}
          label="Stroke"
          property="style.borderColor"
          value={style.borderColor || DEFAULT_BORDER_COLOR}
          defaultColor={DEFAULT_BORDER_COLOR}
          onChange={(borderColor) => updateStyle({ borderColor })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={`${element.id}-border-width`}
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
