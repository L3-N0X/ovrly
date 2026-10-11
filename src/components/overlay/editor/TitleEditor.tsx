import React from "react";
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
} from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { PrismaElement, TitleStyle } from "@/lib/types";
import {
  EffectsSection,
  Field,
  FieldGrid,
  InspectorSection,
  Letter,
  NumberProp,
  SizeProp,
  TextSection,
} from "./fields";
import { HUG_OR_FILL, sizeModePatch, type SizeMode } from "./sizing";
import { useStyleDraft } from "./useStyleDraft";

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Center", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
] as const;

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "Top", icon: AlignStartHorizontal },
  { value: "center", label: "Middle", icon: AlignCenterHorizontal },
  { value: "bottom", label: "Bottom", icon: AlignEndHorizontal },
] as const;

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TitleStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-title`;

  // A title is as big as its text, unless it fills its parent; the text is then aligned in it.
  const sizeMode = (side: "width" | "height"): SizeMode =>
    (side === "width" ? style.fillWidth : style.fillHeight) === true ? "fill" : "hug";
  const setSizeMode = (side: "width" | "height", mode: SizeMode) =>
    update(sizeModePatch(element.id, style, side, mode, 0));

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          {(["width", "height"] as const).map((side) => (
            <SizeProp
              key={side}
              id={`${id}-${side}`}
              side={side}
              modes={HUG_OR_FILL}
              mode={sizeMode(side)}
              onModeChange={(mode) => setSizeMode(side, mode)}
            />
          ))}
          <NumberProp
            id={`${id}-padding-x`}
            label="Horizontal padding"
            prefix={<Letter>X</Letter>}
            property="style.paddingX"
            min={0}
            unit="px"
            value={typeof style.paddingX === "number" ? style.paddingX : 0}
            onChange={(paddingX) => update({ paddingX })}
          />
          <NumberProp
            id={`${id}-padding-y`}
            label="Vertical padding"
            prefix={<Letter>Y</Letter>}
            property="style.paddingY"
            min={0}
            unit="px"
            value={typeof style.paddingY === "number" ? style.paddingY : 0}
            onChange={(paddingY) => update({ paddingY })}
          />
        </FieldGrid>
      </InspectorSection>
      <TextSection
        id={id}
        style={style}
        defaultFontSize={36}
        previewWord={element.title?.text}
        colorProps={colorProps}
        onChange={update}
      >
        <FieldGrid>
          <Field label="Text align" htmlFor={`${id}-text-align`}>
            <SegmentedControl
              id={`${id}-text-align`}
              aria-label="Horizontal text alignment"
              size="sm"
              stretch
              value={style.textAlign ?? "left"}
              onValueChange={(textAlign) => update({ textAlign })}
              options={TEXT_ALIGN_OPTIONS}
            />
          </Field>
          <Field label="Vertical align" htmlFor={`${id}-vertical-align`}>
            <SegmentedControl
              id={`${id}-vertical-align`}
              aria-label="Vertical text alignment"
              size="sm"
              stretch
              value={style.verticalAlign ?? "top"}
              onValueChange={(verticalAlign) => update({ verticalAlign })}
              options={VERTICAL_ALIGN_OPTIONS}
            />
          </Field>
        </FieldGrid>
      </TextSection>
      <EffectsSection id={id} style={style} colorProps={colorProps} onChange={update} />
    </>
  );
};
