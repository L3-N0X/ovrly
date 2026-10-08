import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { BindableField } from "@/components/variables/BindableField";
import { type CounterStyle, type PrismaElement } from "@/lib/types";
import { fontWeightOf } from "@/lib/fonts";
import React, { useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { FontWeightPicker } from "../../FontWeightPicker";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

export const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as CounterStyle) || {}, [element.style]);
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);

  const handleStyleChange = (newStyle: Partial<CounterStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const id = (name: string) => `${element.id}-counter-${name}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            weight={fontWeightOf(style)}
            onChange={(font) => handleStyleChange({ fontFamily: font })}
            previewWord="1234567890"
            className="w-full h-10"
          />
        </div>
        <BindableField property="style.fontSize" label="Font Size" htmlFor={id("font-size")}>
          <NumberField
            id={id("font-size")}
            className="h-10"
            value={(style.fontSize as number) || 128}
            min={0}
            unit="px"
            onChange={(fontSize) => handleStyleChange({ fontSize })}
          />
        </BindableField>
        <div className="space-y-2">
          <Label htmlFor={id("font-weight")}>Font Weight</Label>
          <FontWeightPicker
            id={id("font-weight")}
            value={fontWeightOf(style)}
            onChange={(fontWeight) => handleStyleChange({ fontWeight })}
          />
        </div>
        <BindableField property="style.color" label="Color" htmlFor={id("color")}>
          <ColorField
            id={id("color")}
            value={style.color || "#ffffff"}
            onChange={(color) => handleStyleChange({ color })}
            onOpenChange={setIsPickingColor}
          />
        </BindableField>
        <BindableField property="style.backgroundColor" label="Background" htmlFor={id("background")}>
          <ColorField
            id={id("background")}
            value={style.backgroundColor || "#333333"}
            onChange={(backgroundColor) => handleStyleChange({ backgroundColor })}
            onOpenChange={setIsPickingColor}
          />
        </BindableField>
        <BindableField property="style.padding" label="Padding" htmlFor={id("padding")}>
          <NumberField
            id={id("padding")}
            value={(style.padding as number) || 0}
            min={0}
            unit="px"
            onChange={(padding) => handleStyleChange({ padding })}
          />
        </BindableField>
        <BindableField property="style.radius" label="Corner Radius" htmlFor={id("radius")}>
          <NumberField
            id={id("radius")}
            value={(style.radius as number) || 0}
            min={0}
            unit="px"
            onChange={(radius) => handleStyleChange({ radius })}
          />
        </BindableField>
      </div>
    </div>
  );
};
