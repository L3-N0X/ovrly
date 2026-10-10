import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import {
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  type GroupStyle,
  type PrismaElement,
} from "@/lib/types";
import React from "react";
import {
  CornerRadiusProp,
  EffectsSection,
  FieldGrid,
  FieldHint,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  SizeFields,
  StrokeSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

// X/Y of an element that sits directly inside a group or on a free canvas, for placing it
// precisely. Measured from the parent's top left corner; negative or large values place it
// outside.
export const PositionFields: React.FC<{
  element: PrismaElement;
  onChange: (position: { x: number; y: number }) => void;
}> = ({ element, onChange }) => {
  const style = (element.style || {}) as GroupStyle;
  const x = style.x ?? 0;
  const y = style.y ?? 0;
  return (
    <FieldGrid>
      <NumberProp
        id={`${element.id}-x`}
        label="X"
        prefix={<Letter>X</Letter>}
        property="style.x"
        unit="px"
        value={x}
        onChange={(x) => onChange({ x, y })}
      />
      <NumberProp
        id={`${element.id}-y`}
        label="Y"
        prefix={<Letter>Y</Letter>}
        property="style.y"
        unit="px"
        value={y}
        onChange={(y) => onChange({ x, y })}
      />
    </FieldGrid>
  );
};

// Elements in a group are placed freely: with the Move tool (M) they can be dragged anywhere,
// even past the group's edges or outside the overlay.
export const GroupEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: GroupStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = element.id;

  return (
    <>
      <InspectorSection title="Layout">
        <SizeFields
          id={id}
          width={style.width ?? DEFAULT_GROUP_WIDTH}
          height={style.height ?? DEFAULT_GROUP_HEIGHT}
          onChange={update}
        />
        <BindableField property="style.clip" inline htmlFor={`${id}-clip`} label="Clip content">
          <Switch
            id={`${id}-clip`}
            checked={!!style.clip}
            onCheckedChange={(clip) => update({ clip })}
          />
        </BindableField>
        <FieldHint>
          Children are placed freely. Clipping hides whatever sticks out past the group's edges.
        </FieldHint>
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="radius"
            value={style.radius ?? DEFAULT_BORDER_RADIUS}
            onChange={(radius) => update({ radius })}
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
