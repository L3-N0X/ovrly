import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_RECTANGLE_HEIGHT,
  DEFAULT_RECTANGLE_WIDTH,
  type PrismaElement,
  type RectangleStyle,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { ColorInput, PixelInput, SizeField } from "./appearance";
import { FIXED_OR_FILL, fixedOrFill, sizeModePatch } from "./sizing";

export const RectangleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: RectangleStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as RectangleStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );
  const updateStyle = (patch: Partial<RectangleStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        A plain shape. Pick the Move tool (M) above the canvas and drag its
        corner to size it, or type the size here. A stroke is only drawn once
        its width is above 0.
      </p>
      <SizeField
        id={`${element.id}-width`}
        label={"Width"}
        property="style.width"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "width")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "width", mode, DEFAULT_RECTANGLE_WIDTH))}
        min={1}
        value={style.width ?? DEFAULT_RECTANGLE_WIDTH}
        onChange={(width) => updateStyle({ width })}
      />
      <SizeField
        id={`${element.id}-height`}
        label={"Height"}
        property="style.height"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "height")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "height", mode, DEFAULT_RECTANGLE_HEIGHT))}
        min={1}
        value={style.height ?? DEFAULT_RECTANGLE_HEIGHT}
        onChange={(height) => updateStyle({ height })}
      />
      <div className="grid grid-cols-2 gap-4">
        <ColorInput
          id={`${element.id}-background`}
          label="Background"
          property="style.backgroundColor"
          value={style.backgroundColor || ""}
          defaultColor="#000000"
          onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          onClear={() => updateStyle({ backgroundColor: "" })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={`${element.id}-radius`}
          label="Corner Radius"
          property="style.borderRadius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
          onChange={(borderRadius) => updateStyle({ borderRadius })}
        />
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