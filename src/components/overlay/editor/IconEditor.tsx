import React, { useMemo, useState } from "react";
import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import type { IconStyle, PrismaElement } from "@/lib/types";

export const IconStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: IconStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as IconStyle) || {}, [element.style]);
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);

  const handleStyleChange = (newStyle: Partial<IconStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const id = (name: string) => `${element.id}-icon-${name}`;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={id("size")}>Size</Label>
        <NumberField
          id={id("size")}
          className="h-10"
          value={typeof style.size === "number" ? style.size : 64}
          min={1}
          unit="px"
          onChange={(size) => handleStyleChange({ size })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={id("color")}>Color</Label>
        <ColorField
          id={id("color")}
          value={style.color || "#ffffff"}
          onChange={(color) => handleStyleChange({ color })}
          onOpenChange={setIsPickingColor}
        />
      </div>
    </div>
  );
};
