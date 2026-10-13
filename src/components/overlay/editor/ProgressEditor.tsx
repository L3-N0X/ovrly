import {
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_PROGRESS_BACKGROUND,
  DEFAULT_PROGRESS_FILL,
  DEFAULT_PROGRESS_HEIGHT,
  DEFAULT_PROGRESS_RADIUS,
  DEFAULT_PROGRESS_WIDTH,
  type PrismaElement,
  type ProgressMode,
  type ProgressStyle,
} from "@/lib/types";
import { progressMode } from "@/lib/progress";
import { SegmentedControl } from "@/components/ui/segmented-control";
import React from "react";
import {
  ColorProp,
  CornerRadiusProp,
  EffectsSection,
  FieldGrid,
  FieldHint,
  InspectorSection,
  SizeModeFields,
  StrokeSection,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

export const ProgressEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ProgressStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-progress`;

  return (
    <>
      <InspectorSection title="Progress">
        <SegmentedControl<ProgressMode>
          aria-label="How the value is read"
          size="sm"
          stretch
          value={progressMode(style)}
          onValueChange={(mode) => update({ mode })}
          options={[
            { value: "percent", label: "Percentage" },
            { value: "values", label: "Value of max" },
          ]}
        />
        <FieldHint>
          {progressMode(style) === "percent"
            ? "The value is a percentage from 0 to 100."
            : "The bar is filled to the value out of the maximum, like a song's progress out of its length."}
        </FieldHint>
      </InspectorSection>
      <InspectorSection title="Layout">
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: DEFAULT_PROGRESS_WIDTH, height: DEFAULT_PROGRESS_HEIGHT }}
          onChange={update}
        />
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="borderRadius"
            value={style.borderRadius ?? DEFAULT_PROGRESS_RADIUS}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
      </InspectorSection>
      <InspectorSection title="Fill">
        <FieldGrid>
          <ColorProp
            id={`${id}-fill`}
            label="Bar color"
            property="style.fillColor"
            value={style.fillColor || DEFAULT_PROGRESS_FILL}
            defaultColor={DEFAULT_PROGRESS_FILL}
            onChange={(fillColor) => update({ fillColor })}
            {...colorProps}
          />
          <ColorProp
            id={`${id}-background`}
            label="Track color"
            property="style.backgroundColor"
            value={style.backgroundColor || DEFAULT_PROGRESS_BACKGROUND}
            defaultColor={DEFAULT_PROGRESS_BACKGROUND}
            onChange={(backgroundColor) => update({ backgroundColor })}
            {...colorProps}
          />
        </FieldGrid>
      </InspectorSection>
      <StrokeSection
        id={id}
        color={style.borderColor}
        width={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
        defaultColor={DEFAULT_BORDER_COLOR}
        range={BORDER_WIDTH_RANGE}
        colorProps={colorProps}
        onChange={update}
      />
      <EffectsSection
        id={id}
        style={style}
        spread="available"
        colorProps={colorProps}
        onChange={update}
      />
    </>
  );
};
