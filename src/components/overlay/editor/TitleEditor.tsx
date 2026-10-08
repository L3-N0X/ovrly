import { ColorField } from "@/components/ui/color-picker";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { BindableField } from "@/components/variables/BindableField";
import { type BaseElementStyle, type PrismaElement } from "@/lib/types";
import { fontWeightOf } from "@/lib/fonts";
import React, { useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { FontWeightPicker } from "../../FontWeightPicker";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: BaseElementStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as BaseElementStyle) || {}, [element.style]);
  // Held while the colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);

  // Shown on the canvas right away; saving is debounced by the overlay itself.
  const handleStyleChange = (newStyle: Partial<BaseElementStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const id = (name: string) => `${element.id}-title-${name}`;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Font Family</Label>
        <FontPicker
          value={style?.fontFamily || ""}
          weight={fontWeightOf(style)}
          onChange={(font) => handleStyleChange({ fontFamily: font })}
          className="w-full h-10"
          previewWord={element.title?.text}
        />
      </div>
      <BindableField property="style.fontSize" label="Font Size" htmlFor={id("font-size")}>
        <NumberField
          id={id("font-size")}
          className="h-10"
          value={typeof style?.fontSize === "number" ? style.fontSize : 36}
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
    </div>
  );
};
