import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  type GroupStyle,
  type PrismaElement,
} from "@/lib/types";
import React from "react";

// Whole pixels only. Without `min`, negative values are allowed too.
const PixelInput: React.FC<{
  id: string;
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}> = ({ id, label, value, min, onChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <NumberField id={id} value={value} min={min} unit="px" onChange={onChange} />
  </div>
);

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
      <PixelInput id={`${element.id}-x`} label="X" value={x} onChange={(x) => onChange({ x, y })} />
      <PixelInput id={`${element.id}-y`} label="Y" value={y} onChange={(y) => onChange({ x, y })} />
    </div>
  );
};

export const GroupEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: GroupStyle) => void;
}> = ({ element, onChange }) => {
  const style = (element.style || {}) as GroupStyle;
  const updateStyle = (patch: Partial<GroupStyle>) => onChange({ ...style, ...patch });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elements in a group are placed freely. Pick the Move tool (M) above the canvas to drag
        them into position, even past the group's edges or outside the overlay.
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
        <div className="space-y-2">
          <Label htmlFor={`${element.id}-background`}>Background</Label>
          <ColorField
            id={`${element.id}-background`}
            value={style.backgroundColor || ""}
            defaultColor="#000000"
            onChange={(backgroundColor) => updateStyle({ backgroundColor })}
            // Style updates are merged on the server, so an omitted key wouldn't clear it.
            onClear={() => updateStyle({ backgroundColor: "" })}
          />
        </div>
        <PixelInput
          id={`${element.id}-radius`}
          label="Corner Radius"
          min={0}
          value={typeof style.radius === "number" ? style.radius : 0}
          onChange={(radius) => updateStyle({ radius })}
        />
      </div>
    </div>
  );
};
