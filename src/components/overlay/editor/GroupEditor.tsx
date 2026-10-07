import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { ColorInput, PixelInput } from "./appearance";

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
        value={x}
        onChange={(x) => onChange({ x, y })}
      />
      <PixelInput
        id={`${element.id}-y`}
        label="Y"
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
      <div className="grid grid-cols-2 gap-4">
        <PixelInput
          id={`${element.id}-width`}
          label="Width"
          min={1}
          value={style.width ?? DEFAULT_GROUP_WIDTH}
          onChange={(width) => updateStyle({ width })}
        />
        <PixelInput
          id={`${element.id}-height`}
          label="Height"
          min={1}
          value={style.height ?? DEFAULT_GROUP_HEIGHT}
          onChange={(height) => updateStyle({ height })}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id={`${element.id}-clip`}
          checked={!!style.clip}
          onCheckedChange={(clip) => updateStyle({ clip })}
        />
        <Label htmlFor={`${element.id}-clip`}>
          Clip content
          <span className="ml-1 font-normal text-muted-foreground">
            (hide what sticks out of the group)
          </span>
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorInput
          id={`${element.id}-background`}
          label="Background"
          value={style.backgroundColor || ""}
          defaultColor="#000000"
          onChange={(backgroundColor) => updateStyle({ backgroundColor })}
          onClear={() => updateStyle({ backgroundColor: "" })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={`${element.id}-radius`}
          label="Corner Radius"
          min={BORDER_RADIUS_RANGE.min}
          max={BORDER_RADIUS_RANGE.max}
          value={style.radius ?? DEFAULT_BORDER_RADIUS}
          onChange={(radius) => updateStyle({ radius })}
        />
        <ColorInput
          id={`${element.id}-border-color`}
          label="Stroke"
          value={style.borderColor || DEFAULT_BORDER_COLOR}
          defaultColor={DEFAULT_BORDER_COLOR}
          onChange={(borderColor) => updateStyle({ borderColor })}
          onOpenChange={setIsPickingColor}
        />
        <PixelInput
          id={`${element.id}-border-width`}
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
