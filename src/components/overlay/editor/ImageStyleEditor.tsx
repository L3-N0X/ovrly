import React from "react";
import type { PrismaElement, ImageStyle } from "@/lib/types";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid2x2, Square } from "lucide-react";
import {
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  InspectorSection,
  SizeFields,
  SMALL_CONTROL,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

interface ImageStyleEditorProps {
  element: PrismaElement;
  onChange: (style: ImageStyle) => void;
}

const ImageStyleEditor: React.FC<ImageStyleEditorProps> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-image`;

  return (
    <>
      <InspectorSection title="Layout">
        <SizeFields
          id={id}
          min={0}
          width={style.width || 100}
          height={style.height || 100}
          onChange={update}
        />
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="borderRadius"
            value={style.borderRadius || 0}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
        <FieldGrid>
          <Field label="Fit" htmlFor={`${id}-fit`}>
            <SegmentedControl
              id={`${id}-fit`}
              aria-label="Object fit"
              size="sm"
              stretch
              value={style.objectFit || "cover"}
              onValueChange={(objectFit) => update({ objectFit })}
              options={[
                { value: "cover", label: "Cover" },
                { value: "contain", label: "Contain" },
              ]}
            />
          </Field>
          <Field label="Rendering" htmlFor={`${id}-rendering`}>
            <Select
              value={style.imageRendering || "auto"}
              onValueChange={(value) =>
                update({ imageRendering: value as ImageStyle["imageRendering"] })
              }
            >
              <SelectTrigger id={`${id}-rendering`} className={SMALL_CONTROL}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4" />
                    <span>Smooth</span>
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
          </Field>
        </FieldGrid>
      </InspectorSection>
      <EffectsSection id={id} style={style} colorProps={colorProps} onChange={update} />
    </>
  );
};

export default ImageStyleEditor;
