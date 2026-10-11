import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTAINER_HEIGHT,
  DEFAULT_CONTAINER_WIDTH,
  type ContainerStyle,
  type PrismaElement,
} from "@/lib/types";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BetweenHorizontalStart,
  BetweenVerticalStart,
} from "lucide-react";
import React from "react";
import { alignOptions, isRowDirection, justifyOptions } from "./alignment";
import {
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  FillSection,
  InspectorSection,
  NumberProp,
  SizeModeFields,
  StrokeSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

const SIZE_MODES = ["fixed", "hug", "fill"] as const;

const DIRECTIONS = [
  { value: "column", label: "Vertical", icon: ArrowDown },
  { value: "row", label: "Horizontal", icon: ArrowRight },
  { value: "column-reverse", label: "Vertical, reversed", icon: ArrowUp },
  { value: "row-reverse", label: "Horizontal, reversed", icon: ArrowLeft },
] as const;

// A square with its left and right (or top and bottom) sides drawn heavier, like Figma's
// padding icons.
const PaddingIcon = ({ axis }: { axis: "x" | "y" }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" strokeOpacity="0.45" />
    {axis === "x" ? (
      <path d="M2.5 4v8M13.5 4v8" strokeWidth="2" strokeLinecap="round" />
    ) : (
      <path d="M4 2.5h8M4 13.5h8" strokeWidth="2" strokeLinecap="round" />
    )}
  </svg>
);

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);

  const row = isRowDirection(style.flexDirection);
  const id = (name: string) => `${element.id}-container-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <>
      <InspectorSection title="Layout">
        <SizeModeFields
          elementId={element.id}
          style={style}
          defaultSize={{ width: DEFAULT_CONTAINER_WIDTH, height: DEFAULT_CONTAINER_HEIGHT }}
          modes={SIZE_MODES}
          hugKeys={{ width: "autoWidth", height: "autoHeight" }}
          onChange={update}
        />
        <FieldGrid className="items-end">
          <Field label="Direction" htmlFor={id("direction")}>
            <SegmentedControl
              id={id("direction")}
              aria-label="Direction"
              size="sm"
              stretch
              value={style.flexDirection || "column"}
              onValueChange={(flexDirection) => update({ flexDirection })}
              options={DIRECTIONS}
            />
          </Field>
          <NumberProp
            id={id("gap")}
            label="Gap between items"
            prefix={row ? <BetweenVerticalStart /> : <BetweenHorizontalStart />}
            property="style.gap"
            min={0}
            unit="px"
            value={pixels("gap")}
            onChange={(gap) => update({ gap })}
          />
          <NumberProp
            id={id("padding-x")}
            label="Horizontal padding"
            prefix={<PaddingIcon axis="x" />}
            property="style.paddingX"
            min={0}
            unit="px"
            value={pixels("paddingX")}
            onChange={(paddingX) => update({ paddingX })}
          />
          <NumberProp
            id={id("padding-y")}
            label="Vertical padding"
            prefix={<PaddingIcon axis="y" />}
            property="style.paddingY"
            min={0}
            unit="px"
            value={pixels("paddingY")}
            onChange={(paddingY) => update({ paddingY })}
          />
        </FieldGrid>
        <Field label="Align items" htmlFor={id("align")}>
          <SegmentedControl
            id={id("align")}
            aria-label="Align items"
            size="sm"
            stretch
            value={style.alignItems || "stretch"}
            onValueChange={(v) => update({ alignItems: v as ContainerStyle["alignItems"] })}
            options={alignOptions(row, { stretch: true })}
          />
        </Field>
        <Field label="Justify content" htmlFor={id("justify")}>
          <SegmentedControl
            id={id("justify")}
            aria-label="Justify content"
            size="sm"
            stretch
            value={style.justifyContent || "flex-start"}
            onValueChange={(v) =>
              update({ justifyContent: v as ContainerStyle["justifyContent"] })
            }
            options={justifyOptions(row)}
          />
        </Field>
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={id("border-radius")}
            property="borderRadius"
            value={style.borderRadius ?? DEFAULT_BORDER_RADIUS}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
      </InspectorSection>
      <FillSection
        id={id("fill")}
        value={style.backgroundColor}
        colorProps={colorProps}
        onChange={(backgroundColor) => update({ backgroundColor })}
      />
      <StrokeSection
        id={id("stroke")}
        color={style.borderColor}
        width={style.borderWidth ?? DEFAULT_BORDER_WIDTH}
        colorProps={colorProps}
        onChange={update}
      />
      <EffectsSection
        id={id("effects")}
        style={style}
        spread={spreadFor(style.backgroundColor)}
        colorProps={colorProps}
        onChange={update}
      />
    </>
  );
};
