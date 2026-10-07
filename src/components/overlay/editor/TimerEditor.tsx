import { ColorField } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type PrismaElement, type TimerStyle } from "@/lib/types";
import { Info } from "lucide-react";
import React, { useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { DEFAULT_DURATION_FORMAT } from "@/lib/duration";

export const TimerStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TimerStyle) => void;
}> = ({ element, onChange }) => {
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as TimerStyle) || {}, [element.style]);
  // Held while a colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);

  // Shown on the canvas right away; saving is debounced by the overlay itself.
  const handleStyleChange = (newStyle: Partial<TimerStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    onChange(updatedStyle);
  };

  const id = (name: string) => `${element.id}-timer-${name}`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>Time Format</Label>
          <Popover>
            <PopoverTrigger>
              <Info className="h-4 w-4 cursor-pointer" />
            </PopoverTrigger>
            <PopoverContent>
              <div className="space-y-2 p-4 text-sm">
                <p className="font-semibold">Format hint for entering timer display:</p>
                <p>
                  Use special placeholders for your timer: <strong>D</strong> for days,{" "}
                  <strong>H</strong> for hours, <strong>m</strong> for minutes,{" "}
                  <strong>s</strong> for seconds. The largest one also counts everything above
                  it, so <strong>HH:mm:ss</strong> shows 50:00:00 for two days and two hours.
                </p>
                <p>
                  Example: <strong>H:mm:ss</strong> → 1:05:09
                </p>
                <p>Mix and match as needed for your display:</p>
                <ul className="list-disc list-inside pl-4">
                  <li>
                    <strong>mm:ss</strong> → 07:45 (minutes:seconds)
                  </li>
                  <li>
                    <strong>H:mm</strong> → 3:22 (hours:minutes)
                  </li>
                  <li>
                    <strong>D[d] HH:mm</strong> → 3d 04:20 (days, then hours:minutes)
                  </li>
                  <li>
                    <strong>H[h] mm[min] ss[s]</strong> → 2h 01min 15s (text inside brackets will be
                    shown as written)
                  </li>
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <Input
          value={style?.format || DEFAULT_DURATION_FORMAT}
          onChange={(e) => handleStyleChange({ format: e.target.value })}
          className="h-10 w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            onChange={(font) => handleStyleChange({ fontFamily: font })}
            previewWord="12:34:56"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("font-size")}>Font Size</Label>
          <NumberField
            id={id("font-size")}
            className="h-10"
            value={typeof style?.fontSize === "number" ? style.fontSize : 128}
            min={0}
            unit="px"
            onChange={(fontSize) => handleStyleChange({ fontSize })}
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
        <div className="space-y-2">
          <Label htmlFor={id("background")}>Background</Label>
          <ColorField
            id={id("background")}
            value={style.backgroundColor || "#333333"}
            onChange={(backgroundColor) => handleStyleChange({ backgroundColor })}
            onOpenChange={setIsPickingColor}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("padding")}>Padding</Label>
          <NumberField
            id={id("padding")}
            value={typeof style?.padding === "number" ? style.padding : 0}
            min={0}
            unit="px"
            onChange={(padding) => handleStyleChange({ padding })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("radius")}>Corner Radius</Label>
          <NumberField
            id={id("radius")}
            value={typeof style?.radius === "number" ? style.radius : 0}
            min={0}
            unit="px"
            onChange={(radius) => handleStyleChange({ radius })}
          />
        </div>
      </div>
    </div>
  );
};
