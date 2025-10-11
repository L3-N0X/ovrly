import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type BaseElementStyle, type PrismaElement } from "@/lib/types";
import React from "react";
import { ColorPicker, useColor } from "react-color-palette";
import { FontPicker } from "../../FontPicker";
import { Input } from "@/components/ui/input";
import { handleValueChange } from "./helper";

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: BaseElementStyle) => void;
}> = ({ element, onChange }) => {
  const [color, setColor] = useColor((element.style as BaseElementStyle)?.color || "#ffffff");

  const updateStyle = (path: string, value: string | number) => {
    const newStyle = JSON.parse(JSON.stringify(element.style || {}));
    onChange(handleValueChange(newStyle, path, value));
  };

  const style = (element.style || {}) as BaseElementStyle;

  return (
    <div className="space-y-4 p-4 border rounded-lg mt-2">
      <h4 className="font-semibold">Edit: {element.name}</h4>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[typeof style?.fontSize === "number" ? style.fontSize : 36]}
            onValueChange={(v) => updateStyle("fontSize", v[0])}
            max={200}
            min={0}
          />
          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 36}
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
            className="w-full h-10"
            previewWord={element.title?.text}
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
      </div>
    </div>
  );
};
