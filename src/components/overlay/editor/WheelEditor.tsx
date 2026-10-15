import React from "react";
import { ALargeSmall, Clock, Contrast, Timer } from "lucide-react";
import type { PrismaElement, WheelStyle } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import {
  DEFAULT_WHEEL_BORDER_WIDTH,
  resolveWheelStyle,
  SPIN_SECONDS_RANGE,
  wheelColors,
  WHEEL_LIGHTNESS_STEP_RANGE,
  WHEEL_SIZE_RANGE,
} from "@/lib/wheel";
import {
  ColorProp,
  EffectsSection,
  FieldGrid,
  FieldHint,
  InspectorSection,
  Letter,
  NumberProp,
  StrokeSection,
  TextSection,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

// How a wheel of fortune looks and spins. Its entries are content, edited (and spun) in its
// Content section.
export const WheelEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: WheelStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const resolved = resolveWheelStyle(style);
  const id = `${element.id}-wheel`;
  // A strip of what the segments look like, eight of them, the way they go round.
  const preview = wheelColors(8, resolved);

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          <NumberProp
            id={`${id}-width`}
            property="style.width"
            label="Diameter"
            prefix={<Letter>W</Letter>}
            unit="px"
            min={WHEEL_SIZE_RANGE.min}
            max={WHEEL_SIZE_RANGE.max}
            value={resolved.width}
            onChange={(width) => update({ width })}
          />
          <div
            title="A wheel is round, so its height is its width."
            className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-input bg-input/30 pl-1.5 text-xs text-muted-foreground"
          >
            <Letter>H</Letter>
            <span className="truncate">Auto</span>
          </div>
        </FieldGrid>
      </InspectorSection>

      <InspectorSection title="Segments">
        <div
          aria-hidden
          className="flex h-3 overflow-hidden rounded-sm border border-input"
          title="The segments' colours, in order round the wheel"
        >
          {preview.map((color, index) => (
            <div key={index} className="flex-1" style={{ backgroundColor: color }} />
          ))}
        </div>
        <FieldGrid>
          <ColorProp
            id={`${id}-color-from`}
            label="Gradient start"
            property="style.colorFrom"
            value={resolved.colorFrom}
            onChange={(colorFrom) => update({ colorFrom })}
            {...colorProps}
          />
          <ColorProp
            id={`${id}-color-to`}
            label="Gradient end"
            property="style.colorTo"
            value={resolved.colorTo}
            onChange={(colorTo) => update({ colorTo })}
            {...colorProps}
          />
          <NumberProp
            id={`${id}-lightness-step`}
            label="Alternating brightness"
            prefix={<Contrast />}
            unit="%"
            min={WHEEL_LIGHTNESS_STEP_RANGE.min}
            max={WHEEL_LIGHTNESS_STEP_RANGE.max}
            value={resolved.lightnessStep}
            onChange={(lightnessStep) => update({ lightnessStep })}
          />
          <ColorProp
            id={`${id}-pointer-color`}
            label="Pointer and hub"
            property="style.pointerColor"
            value={resolved.pointerColor}
            onChange={(pointerColor) => update({ pointerColor })}
            {...colorProps}
          />
        </FieldGrid>
        <FieldHint>
          The colours run from the start round to the end and back, mixed in OKLCH. Every other
          segment is lighter or darker by the alternating brightness.
        </FieldHint>
      </InspectorSection>

      <TextSection
        id={id}
        style={style}
        defaultFontSize={resolved.fontSize}
        fontSizeLabel="Largest label size (all labels share one size)"
        previewWord="Spin"
        colorProps={colorProps}
        onChange={update}
      />

      <InspectorSection title="Spin">
        <FieldGrid>
          <NumberProp
            id={`${id}-spin-duration`}
            label="Spin duration"
            prefix={<Timer />}
            unit="s"
            min={SPIN_SECONDS_RANGE.min}
            max={SPIN_SECONDS_RANGE.max}
            step={0.5}
            value={resolved.spinDuration}
            onChange={(spinDuration) => update({ spinDuration })}
          />
        </FieldGrid>
        <BindableField
          inline
          htmlFor={`${id}-show-result`}
          label={
            <>
              Reveal the result
              <span className="ml-1 font-normal text-muted-foreground">(big, in the middle)</span>
            </>
          }
        >
          <Switch
            id={`${id}-show-result`}
            checked={resolved.showResult}
            onCheckedChange={(showResult) => update({ showResult })}
          />
        </BindableField>
        {resolved.showResult && (
          <>
            <FieldGrid>
              <NumberProp
                id={`${id}-result-size`}
                label="Result font size"
                prefix={<ALargeSmall />}
                property="style.resultFontSize"
                unit="px"
                min={1}
                value={resolved.resultFontSize}
                onChange={(resultFontSize) => update({ resultFontSize })}
              />
              <NumberProp
                id={`${id}-result-duration`}
                label="Hide the result after (0 keeps it up until the next spin)"
                prefix={<Clock />}
                unit="s"
                min={0}
                value={resolved.resultDuration}
                onChange={(resultDuration) => update({ resultDuration })}
              />
            </FieldGrid>
            <FieldHint>The result card takes the colour of the segment it landed on.</FieldHint>
          </>
        )}
      </InspectorSection>

      <StrokeSection
        id={id}
        color={style.borderColor}
        width={style.borderWidth ?? DEFAULT_WHEEL_BORDER_WIDTH}
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
