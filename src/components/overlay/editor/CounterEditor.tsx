import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type CounterStyle, type PrismaElement } from "@/lib/types";
import React, { useMemo, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { Input } from "@/components/ui/input";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { useSliderValue } from "@/lib/hooks/useSliderValue";
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

  const fontSizeSlider = useSliderValue((style.fontSize as number) || 128, {
    onCommit: (v) => handleStyleChange({ fontSize: v }),
  });
  const paddingSlider = useSliderValue((style.padding as number) || 0, {
    onCommit: (v) => handleStyleChange({ padding: v }),
  });
  const radiusSlider = useSliderValue((style.radius as number) || 0, {
    onCommit: (v) => handleStyleChange({ radius: v }),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[fontSizeSlider.value]}
            onValueChange={([v]) => fontSizeSlider.onChange(v)}
            onPointerDown={fontSizeSlider.onInteractionStart}
            onValueCommit={fontSizeSlider.onInteractionEnd}
            max={400}
            min={0}
          />

          <Input
            value={fontSizeSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                fontSizeSlider.onChange(0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                fontSizeSlider.onChange(val);
              }
            }}
            onBlur={() => fontSizeSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Font Family</Label>
          <FontPicker
            value={style?.fontFamily || ""}
            onChange={(font) => handleStyleChange({ fontFamily: font })}
            previewWord="1234567890"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Popover onOpenChange={setIsPickingColor}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.color || "#ffffff" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.color || "#ffffff"}
                onChange={(c) => {
                  handleStyleChange({ color: c });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Background</Label>
          <Popover onOpenChange={setIsPickingColor}>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: style.backgroundColor || "#333333" }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPickerEditor
                value={style.backgroundColor || "#333333"}
                onChange={(c) => {
                  handleStyleChange({ backgroundColor: c });
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Padding</Label>
          <div className="flex gap-4">
            <Slider
              value={[paddingSlider.value]}
              onValueChange={([v]) => paddingSlider.onChange(v)}
              onPointerDown={paddingSlider.onInteractionStart}
              onValueCommit={paddingSlider.onInteractionEnd}
              max={300}
              min={0}
            />
            <Input
              value={paddingSlider.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  paddingSlider.onChange(0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  paddingSlider.onChange(val);
                }
              }}
              onBlur={() => paddingSlider.onInteractionEnd()}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Corner Radius</Label>
          <div className="flex gap-4">
            <Slider
              value={[radiusSlider.value]}
              onValueChange={([v]) => radiusSlider.onChange(v)}
              onPointerDown={radiusSlider.onInteractionStart}
              onValueCommit={radiusSlider.onInteractionEnd}
              max={100}
            />{" "}
            <Input
              value={radiusSlider.value}
              onChange={(e) => {
                if (e.target.value === "") {
                  radiusSlider.onChange(0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  radiusSlider.onChange(val);
                }
              }}
              onBlur={() => radiusSlider.onInteractionEnd()}
              className="h-10 w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
