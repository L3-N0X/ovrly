import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { type BaseElementStyle, type PrismaElement, type OnOverlayChange } from "@/lib/types";
import React, { useEffect, useState } from "react";
import { FontPicker } from "../../FontPicker";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPickerEditor } from "./ColorPickerEditor";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { useSliderValue } from "@/lib/hooks/useSliderValue";
import { RenameElementModal } from "./RenameElementModal";

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onOverlayChange: OnOverlayChange;
  onChange: (newStyle: BaseElementStyle) => void;
  onDelete?: () => void;
}> = ({ element, onOverlayChange, onChange, onDelete }) => {
  const [style, setStyle] = useState<BaseElementStyle>((element.style as BaseElementStyle) || {});
  const [isPickingColor, setIsPickingColor] = useState(false);

  const debouncedOnChange = useDebouncedCallback(onChange, 400);

  useEffect(() => {
    if (!isPickingColor) {
      setStyle((element.style as BaseElementStyle) || {});
    }
  }, [element.style, isPickingColor]);

  const handleStyleChange = (newStyle: Partial<BaseElementStyle>) => {
    const updatedStyle = { ...style, ...newStyle };
    setStyle(updatedStyle);
    debouncedOnChange(updatedStyle);
  };

  // responsive local slider
  const syncedFontSize = useSliderValue(typeof style?.fontSize === "number" ? style.fontSize : 36);

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold">Edit: {element.name}</h4>
        <div className="flex items-center">
          <RenameElementModal element={element} onOverlayChange={onOverlayChange}>
            <Button variant="ghost" size="icon-lg">
              <Pencil />
            </Button>
          </RenameElementModal>
          <Button variant="destructiveGhost" size="icon-lg" onClick={onDelete}>
            <Trash2 />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Font Size</Label>
        <div className="flex gap-4">
          <Slider
            value={[syncedFontSize.value]}
            onValueChange={(v) => {
              const val = v[0];
              syncedFontSize.onChange(val);
              handleStyleChange({ fontSize: val });
            }}
            onPointerDown={syncedFontSize.onInteractionStart}
            onValueCommit={syncedFontSize.onInteractionEnd}
            max={200}
            min={0}
          />
          <Input
            value={typeof style?.fontSize === "number" ? style.fontSize : 36}
            onChange={(e) => {
              if (e.target.value === "") {
                syncedFontSize.onChange(0);
                handleStyleChange({ fontSize: 0 });
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                syncedFontSize.onChange(val);
                handleStyleChange({ fontSize: val });
              }
            }}
            onBlur={() => syncedFontSize.onInteractionEnd()}
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
            className="w-full h-10"
            previewWord={element.title?.text}
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
      </div>
    </div>
  );
};
