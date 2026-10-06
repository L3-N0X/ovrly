import React, { useMemo } from "react";
import type { PrismaElement, ImageStyle } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { GalleryHorizontal, Grid2x2, ScanEye, Square } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useSliderValue } from "@/lib/hooks/useSliderValue";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

interface ImageStyleEditorProps {
  element: PrismaElement;
  onChange: (style: ImageStyle) => void;
}

const ImageStyleEditor: React.FC<ImageStyleEditorProps> = ({
  element,
  onChange,
}) => {
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(() => (element.style as ImageStyle) || {}, [element.style]);
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle);

  const handleImmediateValueChange = (
    key: keyof ImageStyle,
    value: ImageStyle[keyof ImageStyle]
  ) => {
    const newStyle = { ...style, [key]: value };
    setStyle(newStyle);
    onChange(newStyle);
  };

  // Committed when the slider is released or the input loses focus. Saving from an effect
  // on the slider value instead would write on every mount and echo every remote change.
  const commitIfChanged = (key: "width" | "height" | "borderRadius", value: number) => {
    if (style[key] !== value) handleImmediateValueChange(key, value);
  };
  const widthSlider = useSliderValue(style.width || 100, {
    onCommit: (v) => commitIfChanged("width", v),
  });
  const heightSlider = useSliderValue(style.height || 100, {
    onCommit: (v) => commitIfChanged("height", v),
  });
  const borderRadiusSlider = useSliderValue(style.borderRadius || 0, {
    onCommit: (v) => commitIfChanged("borderRadius", v),
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Width</Label>
        <div className="flex gap-4">
          <Slider
            value={[widthSlider.value]}
            onValueChange={([val]) => widthSlider.onChange(val)}
            onPointerDown={widthSlider.onInteractionStart}
            onValueCommit={widthSlider.onInteractionEnd}
            max={1024}
            step={1}
          />
          <Input
            value={widthSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                widthSlider.onChange(0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                widthSlider.onChange(val);
              }
            }}
            onBlur={() => widthSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Height</Label>
        <div className="flex gap-4">
          <Slider
            value={[heightSlider.value]}
            onValueChange={([val]) => heightSlider.onChange(val)}
            onPointerDown={heightSlider.onInteractionStart}
            onValueCommit={heightSlider.onInteractionEnd}
            max={1024}
            step={1}
          />
          <Input
            value={heightSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                heightSlider.onChange(0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                heightSlider.onChange(val);
              }
            }}
            onBlur={() => heightSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Border Radius</Label>
        <div className="flex gap-4">
          <Slider
            value={[borderRadiusSlider.value]}
            onValueChange={([val]) => borderRadiusSlider.onChange(val)}
            onPointerDown={borderRadiusSlider.onInteractionStart}
            onValueCommit={borderRadiusSlider.onInteractionEnd}
            max={500}
            step={1}
          />
          <Input
            value={borderRadiusSlider.value}
            onChange={(e) => {
              if (e.target.value === "") {
                borderRadiusSlider.onChange(0);
                return;
              }
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                borderRadiusSlider.onChange(val);
              }
            }}
            onBlur={() => borderRadiusSlider.onInteractionEnd()}
            className="h-10 w-20"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Object Fit</Label>
          <ToggleGroup
            type="single"
            value={style.objectFit || "cover"}
            onValueChange={(value) => value && handleImmediateValueChange("objectFit", value)}
            className="w-full h-10"
            variant="outline"
          >
            <ToggleGroupItem value="cover" className="w-full">
              <GalleryHorizontal className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="contain" className="w-full">
              <ScanEye className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-2">
          <Label>Image Rendering</Label>
          <Select
            value={style.imageRendering || "auto"}
            onValueChange={(value) => handleImmediateValueChange("imageRendering", value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex items-center gap-2">
                  <Square className="h-4 w-4" />
                  <span>Normal</span>
                </div>
              </SelectItem>
              <SelectItem value="pixelated">
                <div className="flex items-center gap-2">
                  <Grid2x2 className="h-4 w-4" />
                  <span>Pixelated</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ImageStyleEditor;
