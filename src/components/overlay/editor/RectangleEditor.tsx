import {
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_RECTANGLE_HEIGHT,
  DEFAULT_RECTANGLE_WIDTH,
  type PrismaElement,
  type RectangleStyle,
} from "@/lib/types";
import React from "react";
import {
  CornerRadiusProp,
  EffectsSection,
  FieldGrid,
  FillSection,
  InspectorSection,
  SizeFields,
  StrokeSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

// A plain shape: sized here or by dragging its corner with the Move tool (M).
export const RectangleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: RectangleStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = element.id;

  return (
    <>
      <InspectorSection title="Layout">
        <SizeFields
          id={id}
          width={style.width ?? DEFAULT_RECTANGLE_WIDTH}
          height={style.height ?? DEFAULT_RECTANGLE_HEIGHT}
          onChange={update}
        />
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="borderRadius"
            value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
      </InspectorSection>
      <FillSection
        id={id}
        value={style.backgroundColor}
        colorProps={colorProps}
        onChange={(backgroundColor) => update({ backgroundColor })}
      />
      <StrokeSection
        id={id}
        color={style.borderColor}
        width={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
        colorProps={colorProps}
        onChange={update}
      />
      <EffectsSection
        id={id}
        style={style}
        spread={spreadFor(style.backgroundColor)}
        colorProps={colorProps}
        onChange={update}
      />
    </>
  );
};
