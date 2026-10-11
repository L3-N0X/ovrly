import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BindableField } from "@/components/variables/BindableField";
import {
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_SCROLLER_HEIGHT,
  DEFAULT_SCROLLER_PAUSE,
  DEFAULT_SCROLLER_SPEED,
  DEFAULT_SCROLLER_WIDTH,
  SCROLLER_PAUSE_RANGE,
  SCROLLER_SPEED_RANGE,
  type PrismaElement,
  type ScrollerMode,
  type ScrollerStyle,
} from "@/lib/types";
import { BetweenHorizontalStart, BetweenVerticalStart, Clock, Gauge } from "lucide-react";
import React from "react";
import { alignOptions } from "./alignment";
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
import { spreadFor, useStyleDraft } from "./useStyleDraft";

const DIRECTION_OPTIONS = [
  { value: "vertical", label: "Vertical" },
  { value: "horizontal", label: "Horizontal" },
] as const;

const MODE_OPTIONS = [
  { value: "bounce", label: "Back and forth" },
  { value: "loop", label: "Loop" },
] as const;

export const ScrollerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ScrollerStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);

  const vertical = style.direction !== "horizontal";
  const mode: ScrollerMode = style.mode === "loop" ? "loop" : "bounce";
  const id = `${element.id}-scroller`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <>
      <InspectorSection title="Scrolling">
        <FieldGrid>
          <Field label="Direction" htmlFor={`${id}-direction`}>
            <SegmentedControl
              id={`${id}-direction`}
              aria-label="Scroll direction"
              size="sm"
              stretch
              value={vertical ? "vertical" : "horizontal"}
              onValueChange={(direction) => update({ direction })}
              options={DIRECTION_OPTIONS}
            />
          </Field>
          <Field label="Mode" htmlFor={`${id}-mode`}>
            <SegmentedControl
              id={`${id}-mode`}
              aria-label="Scrolling"
              size="sm"
              stretch
              value={mode}
              onValueChange={(mode) => update({ mode })}
              options={MODE_OPTIONS}
            />
          </Field>
        </FieldGrid>
        <FieldGrid>
          <NumberProp
            id={`${id}-speed`}
            label="Speed"
            prefix={<Gauge />}
            property="style.speed"
            min={SCROLLER_SPEED_RANGE.min}
            max={SCROLLER_SPEED_RANGE.max}
            unit="px/s"
            value={style.speed ?? DEFAULT_SCROLLER_SPEED}
            onChange={(speed) => update({ speed })}
          />
          {mode === "bounce" && (
            <NumberProp
              id={`${id}-pause`}
              label="Pause at the ends"
              prefix={<Clock />}
              property="style.pause"
              min={SCROLLER_PAUSE_RANGE.min}
              max={SCROLLER_PAUSE_RANGE.max}
              step={0.5}
              unit="s"
              value={style.pause ?? DEFAULT_SCROLLER_PAUSE}
              onChange={(pause) => update({ pause })}
            />
          )}
        </FieldGrid>
        <FieldHint>
          Lines up the elements inside it and scrolls through them by itself once they are longer
          than the box. It holds still while the Move tool (M) is on, so pick hidden children from
          the element list.
        </FieldHint>
      </InspectorSection>
      <InspectorSection title="Layout">
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: DEFAULT_SCROLLER_WIDTH, height: DEFAULT_SCROLLER_HEIGHT }}
          onChange={update}
        />
        <FieldHint>
          {vertical ? "The height" : "The width"} is the most the box grows to.
        </FieldHint>
        <BindableField inline htmlFor={`${id}-fit-content`} label="Shrink to the content while it fits">
          <Switch
            id={`${id}-fit-content`}
            checked={style.fitContent === true}
            onCheckedChange={(fitContent) => update({ fitContent })}
          />
        </BindableField>
        <FieldGrid>
          <NumberProp
            id={`${id}-gap`}
            label="Gap between items"
            prefix={vertical ? <BetweenHorizontalStart /> : <BetweenVerticalStart />}
            property="style.gap"
            min={0}
            unit="px"
            value={pixels("gap")}
            onChange={(gap) => update({ gap })}
          />
          <span />
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
        <Field label="Align items" htmlFor={`${id}-align`}>
          <SegmentedControl
            id={`${id}-align`}
            aria-label="Align items"
            size="sm"
            stretch
            value={style.alignItems || "stretch"}
            onValueChange={(v) => update({ alignItems: v as ScrollerStyle["alignItems"] })}
            options={alignOptions(!vertical, { stretch: true }).filter(
              (option) => option.value !== "baseline"
            )}
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
