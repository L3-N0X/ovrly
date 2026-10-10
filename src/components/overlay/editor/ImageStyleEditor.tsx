import React, { useMemo } from "react";
import type { PrismaElement, ImageStyle } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid2x2, Square } from "lucide-react";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import { SizeField } from "./appearance";
import { FIXED_OR_FILL, fixedOrFill, sizeModePatch } from "./sizing";

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

  const updateStyle = (patch: Partial<ImageStyle>) => {
    const newStyle = { ...style, ...patch };
    setStyle(newStyle);
    onChange(newStyle);
  };

  const handleImmediateValueChange = (
    key: keyof ImageStyle,
    value: ImageStyle[keyof ImageStyle]
  ) => {
    const newStyle = { ...style, [key]: value };
    setStyle(newStyle);
    onChange(newStyle);
  };

  const id = (name: string) => `${element.id}-image-${name}`;

  return (
    <div className="space-y-4">
      <SizeField
        id={id("width")}
        label={"Width"}
        property="style.width"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "width")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "width", mode, 100))}
        min={1}
        value={style.width || 100}
        onChange={(width) => updateStyle({ width })}
      />
      <SizeField
        id={id("height")}
        label={"Height"}
        property="style.height"
        modes={FIXED_OR_FILL}
        mode={fixedOrFill(style, "height")}
        onModeChange={(mode) => updateStyle(sizeModePatch(element.id, style, "height", mode, 100))}
        min={1}
        value={style.height || 100}
        onChange={(height) => updateStyle({ height })}
      />
      <div className="grid grid-cols-2 gap-4">
        <BindableField property="style.borderRadius" label="Border Radius" htmlFor={id("radius")}>
          <NumberField
            id={id("radius")}
            value={style.borderRadius || 0}
            min={0}
            unit="px"
            onChange={(borderRadius) => handleImmediateValueChange("borderRadius", borderRadius)}
          />
        </BindableField>
        <div className="space-y-2">
          <Label htmlFor={id("fit")}>Object Fit</Label>
          <SegmentedControl
            id={id("fit")}
            aria-label="Object fit"
            value={style.objectFit || "cover"}
            onValueChange={(value) => handleImmediateValueChange("objectFit", value)}
            options={[
              { value: "cover", label: "Cover" },
              { value: "contain", label: "Contain" },
            ]}
          />
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
