import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type CounterStyle, type PrismaElement } from "@/lib/types";
import React from "react";
import { ColorPicker, useColor } from "react-color-palette";
import { FontPicker } from "../../FontPicker";
import { handleValueChange } from "./helper";
import { Input } from "@/components/ui/input";
export const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
}> = ({ element, onChange }) => {
  const [color, setColor] = useColor((element.style as CounterStyle)?.color || "#ffffff");
  const [bgColor, setBgColor] = useColor(
    (element.style as CounterStyle)?.backgroundColor || "#333333"
  );

  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as CounterStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg mt-2">
      <h4 className="font-semibold">Edit: {element.name}</h4>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[typeof style?.fontSize === "number" ? style.fontSize : 128]}
            onValueChange={(v) => updateStyle("fontSize", v[0])}
            max={400}
            min={0}
          />

          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 128}
            onChange={(e) => {
              if (e.target.value === "") {
                updateStyle("fontSize", 0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                updateStyle("fontSize", val);
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
            onChange={(font) => updateStyle("fontFamily", font)}
            previewWord="1234567890"
            className="w-full h-10"
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: color.hex }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPicker
                color={color}
                onChange={(c) => {
                  setColor(c);
                  updateStyle("color", c.hex);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Background</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full h-10 rounded-md border"
                style={{ backgroundColor: bgColor.hex }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <ColorPicker
                color={bgColor}
                onChange={(c) => {
                  setBgColor(c);
                  updateStyle("backgroundColor", c.hex);
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
              onValueChange={(v) => updateStyle("padding", v[0])}
              max={300}
              min={0}
            />
            <Input
              value={typeof style?.padding === "number" ? style.padding : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("padding", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("padding", val);
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
              onValueChange={(v) => updateStyle("radius", v[0])}
              max={100}
            />
            <Input
              value={typeof style?.radius === "number" ? style.radius : 0}
              onChange={(e) => {
                if (e.target.value === "") {
                  updateStyle("radius", 0);
                  return;
                }
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  updateStyle("radius", val);
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
