import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type CounterStyle, type PrismaElement } from "@/lib/types";
import React, { useCallback, useEffect, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { debounce } from "@/lib/utils";

export const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
  onDelete?: () => void;
}> = ({ element, onChange, onDelete }) => {
  const [style, setStyle] = useState<CounterStyle>(
    (element.style as CounterStyle) || {}
  );
  const [isPickingColor, setIsPickingColor] = useState(false);

  const debouncedOnChange = useCallback(debounce(onChange, 400), [onChange]);

  useEffect(() => {
    if (!isPickingColor) {
      setStyle((element.style as CounterStyle) || {});
    }
  }, [element.style, isPickingColor]);

  const handleStyleChange = (newStyle: Partial<CounterStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    debouncedOnChange(updatedStyle);
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[typeof style?.fontSize === "number" ? style.fontSize : 128]}
            onValueChange={(v) => handleStyleChange({ fontSize: v[0] })}
            max={400}
            min={0}
          />

          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 128}
            onChange={(e) => {
              if (e.target.value === "") {
                handleStyleChange({ fontSize: 0 });
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                handleStyleChange({ fontSize: val });
              }
            }}
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
        <div className="space-y-2">
          <Label>Padding</Label>
          <div className="flex gap-4">
            <Slider
              value={[
                (() => {
                  const padding = (element.style as CounterStyle)?.padding;
                  return padding !== undefined && padding !== null ? padding : 0;
                })(),
              ]}
              onValueChange={(v) => handleStyleChange({ padding: v[0] })}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.padding === "number" ? style.padding : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  handleStyleChange({ padding: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleStyleChange({ padding: val });
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Corner Radius</Label>
          <div className="flex gap-4">
            <Slider
              value={[
                (() => {
                  const radius = (element.style as CounterStyle)?.radius;
                  return radius !== undefined && radius !== null ? radius : 0;
                })(),
              ]}
              onValueChange={(v) => handleStyleChange({ radius: v[0] })}
              max={100}
            />
            <Input
              value={typeof style?.radius === "number" ? style.radius : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  handleStyleChange({ radius: 0 });
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  handleStyleChange({ radius: val });
                }
              }}
              className="h-10 w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
