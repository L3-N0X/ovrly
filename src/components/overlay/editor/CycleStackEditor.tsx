import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Clock,
  StretchHorizontal,
  StretchVertical,
  Timer,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  BORDER_WIDTH_RANGE,
  CYCLE_STACK_INTERVAL_RANGE,
  CYCLE_STACK_TRANSITION_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CYCLE_STACK_HEIGHT,
  DEFAULT_CYCLE_STACK_INTERVAL,
  DEFAULT_CYCLE_STACK_TRANSITION_DURATION,
  DEFAULT_CYCLE_STACK_WIDTH,
  type CycleStackStyle,
  type CycleStackTransition,
  type PrismaElement,
} from "@/lib/types";
import React from "react";
import {
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  FieldHint,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  SizeModeFields,
  StrokeSection,
} from "./fields";
import { FIXED_OR_FILL, HUG_OR_FILL } from "./sizing";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

const TRANSITION_OPTIONS = [
  { value: "fade", label: "Fade" },
  { value: "none", label: "Cut" },
] as const;

const HORIZONTAL_OPTIONS = [
  { value: "start", label: "Left", icon: AlignStartVertical },
  { value: "center", label: "Center", icon: AlignCenterVertical },
  { value: "end", label: "Right", icon: AlignEndVertical },
  { value: "stretch", label: "Stretch", icon: StretchHorizontal },
] as const;

const VERTICAL_OPTIONS = [
  { value: "start", label: "Top", icon: AlignStartHorizontal },
  { value: "center", label: "Center", icon: AlignCenterHorizontal },
  { value: "end", label: "Bottom", icon: AlignEndHorizontal },
  { value: "stretch", label: "Stretch", icon: StretchVertical },
] as const;

export const CycleStackEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CycleStackStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);

  const transition: CycleStackTransition = style.transition === "none" ? "none" : "fade";
  const fitContent = style.fitContent === true;
  const id = `${element.id}-cycle-stack`;
  const pixels = (key: "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <>
      <InspectorSection title="Cycling">
        <FieldGrid>
          <NumberProp
            id={`${id}-interval`}
            label="Show each layer for"
            prefix={<Timer />}
            property="style.interval"
            min={CYCLE_STACK_INTERVAL_RANGE.min}
            max={CYCLE_STACK_INTERVAL_RANGE.max}
            step={0.5}
            unit="s"
            value={style.interval ?? DEFAULT_CYCLE_STACK_INTERVAL}
            onChange={(interval) => update({ interval })}
          />
          {transition === "fade" && (
            <NumberProp
              id={`${id}-transition-duration`}
              label="Fade duration"
              prefix={<Clock />}
              property="style.transitionDuration"
              min={CYCLE_STACK_TRANSITION_RANGE.min}
              max={CYCLE_STACK_TRANSITION_RANGE.max}
              step={0.1}
              unit="s"
              value={style.transitionDuration ?? DEFAULT_CYCLE_STACK_TRANSITION_DURATION}
              onChange={(transitionDuration) => update({ transitionDuration })}
            />
          )}
        </FieldGrid>
        <Field label="Transition" htmlFor={`${id}-transition`}>
          <SegmentedControl
            id={`${id}-transition`}
            aria-label="Transition"
            size="sm"
            stretch
            value={transition}
            onValueChange={(transition) => update({ transition })}
            options={TRANSITION_OPTIONS}
          />
        </Field>
        <FieldHint>
          Puts the elements inside it on top of each other and shows one at a time. Selecting a
          layer (or something in it) shows it here in the editor; pause the stack under Content to
          keep one up in OBS too.
        </FieldHint>
      </InspectorSection>
      <InspectorSection title="Layout">
        <BindableField inline htmlFor={`${id}-fit-content`} label="Size to the biggest layer">
          <Switch
            id={`${id}-fit-content`}
            checked={fitContent}
            onCheckedChange={(fitContent) => update({ fitContent })}
          />
        </BindableField>
        {/* Sized to the biggest layer, a side hugs it unless it fills the parent. */}
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: DEFAULT_CYCLE_STACK_WIDTH, height: DEFAULT_CYCLE_STACK_HEIGHT }}
          modes={fitContent ? HUG_OR_FILL : FIXED_OR_FILL}
          hugging={fitContent}
          onChange={update}
        />
        <FieldGrid>
          <NumberProp
            id={`${id}-padding-x`}
            label="Horizontal padding"
            prefix={<Letter>X</Letter>}
            property="style.paddingX"
            min={0}
            unit="px"
            value={pixels("paddingX")}
            onChange={(paddingX) => update({ paddingX })}
          />
          <NumberProp
            id={`${id}-padding-y`}
            label="Vertical padding"
            prefix={<Letter>Y</Letter>}
            property="style.paddingY"
            min={0}
            unit="px"
            value={pixels("paddingY")}
            onChange={(paddingY) => update({ paddingY })}
          />
        </FieldGrid>
        <Field label="Horizontal alignment" htmlFor={`${id}-justify`}>
          <SegmentedControl
            id={`${id}-justify`}
            aria-label="Horizontal alignment"
            size="sm"
            stretch
            value={style.justifyItems || "center"}
            onValueChange={(justifyItems) => update({ justifyItems })}
            options={HORIZONTAL_OPTIONS}
          />
        </Field>
        <Field label="Vertical alignment" htmlFor={`${id}-align`}>
          <SegmentedControl
            id={`${id}-align`}
            aria-label="Vertical alignment"
            size="sm"
            stretch
            value={style.alignItems || "center"}
            onValueChange={(alignItems) => update({ alignItems })}
            options={VERTICAL_OPTIONS}
          />
        </Field>
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
        defaultColor={DEFAULT_BORDER_COLOR}
        range={BORDER_WIDTH_RANGE}
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
