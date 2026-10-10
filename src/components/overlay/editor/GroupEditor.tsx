import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import {
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  type GroupStyle,
  type PrismaElement,
} from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import React, { useMemo, useState } from "react";
import { ColorInput, PixelInput, SizeField } from "./appearance";
import { FIXED_OR_FILL, fixedOrFill, sizeModePatch } from "./sizing";

// X/Y of an element that sits directly inside a group, for placing it precisely. Measured
// from the group's top left corner; negative or large values place it outside the group.
export const GroupPositionEditor: React.FC<{
  element: PrismaElement;
  onChange: (position: { x: number; y: number }) => void;
}> = ({ element, onChange }) => {
  const style = (element.style || {}) as GroupStyle;
  const x = style.x ?? 0;
  const y = style.y ?? 0;
  return (
    <div className="grid grid-cols-2 gap-4">
      <PixelInput
        id={`${element.id}-x`}
        label="X"
        property="style.x"
        value={x}
        onChange={(x) => onChange({ x, y })}
      />
      <PixelInput
        id={`${element.id}-y`}
        label="Y"
        property="style.y"
        value={y}
        onChange={(y) => onChange({ x, y })}
      />
    </div>
  );
};

export const GroupEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: GroupStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (element.style || {}) as GroupStyle,
    [element.style],
  );
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(
    serverStyle,
    isPickingColor,
  );
  const updateStyle = (patch: Partial<GroupStyle>) => {
    const updatedStyle = { ...style, ...patch };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elements in a group are placed freely. Pick the Move tool (M) above the
        canvas to drag them into position, even past the group's edges or
        outside the overlay.
      </p>
      <SizeField
        id={`${element.id}-width`}
        label={"Width"}
        property="style.width"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "width")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "width", mode, DEFAULT_GROUP_WIDTH))}
        min={1}
        value={style.width ?? DEFAULT_GROUP_WIDTH}
        onChange={(width) => updateStyle({ width })}
      />
      <SizeField
        id={`${element.id}-height`}
        label={"Height"}
        property="style.height"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "height")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "height", mode, DEFAULT_GROUP_HEIGHT))}
        min={1}
        value={style.height ?? DEFAULT_GROUP_HEIGHT}
        onChange={(height) => updateStyle({ height })}
      />
      <BindableField
        property="style.clip"
        inline
        htmlFor={`${element.id}-clip`}
        label={
          <>
            Clip content
            <span className="ml-1 font-normal text-muted-foreground">
              (hide what sticks out of the group)
            </span>
          </>
        }
      >
        <Switch
          id={`${element.id}-clip`}
          checked={!!style.clip}
          onCheckedChange={(clip) => updateStyle({ clip })}
        />
      </BindableField>
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
          property="style.radius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.radius ?? DEFAULT_BORDER_RADIUS}
          onChange={(radius) => updateStyle({ radius })}
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
