import React from "react";
import { Ratio } from "lucide-react";
import type { IconStyle, PrismaElement } from "@/lib/types";
import {
  EffectsSection,
  FieldGrid,
  FillSection,
  InspectorSection,
  NumberProp,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

export const IconStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: IconStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-icon`;

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          {/* Icons are square, so one size is both their width and height. */}
          <NumberProp
            id={`${id}-size`}
            label="Size (width and height)"
            prefix={<Ratio />}
            property="style.size"
            min={1}
            unit="px"
            value={typeof style.size === "number" ? style.size : 64}
            onChange={(size) => update({ size })}
          />
        </FieldGrid>
      </InspectorSection>
      {/* An icon's colour is what fills its drawing, as in Figma. */}
      <FillSection
        id={id}
        value={style.color || "#ffffff"}
        optional={false}
        property="style.color"
        label="Color"
        colorProps={colorProps}
        onChange={(color) => update({ color: color || "#ffffff" })}
      />
      <EffectsSection id={id} style={style} colorProps={colorProps} onChange={update} />
    </>
  );
};
