import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DEFAULT_BORDER_RADIUS,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_CONTAINER_HEIGHT,
  DEFAULT_CONTAINER_WIDTH,
  type ContainerStyle,
  type PrismaElement,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  FoldVertical,
  UnfoldHorizontal,
} from "lucide-react";
import React from "react";
import { CANVAS_ELEMENT_ATTRIBUTE } from "../canvasSelection";
import { alignOptions, isRowDirection, justifyOptions } from "./alignment";
import {
  CornerRadiusProp,
  EffectsSection,
  Field,
  FieldGrid,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  StrokeSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

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

/**
 * One side of the container: a fixed size, or automatic (the width fills the parent, the height
 * hugs the children), switched by the button next to it.
 */
const SideField: React.FC<{
  id: string;
  side: "width" | "height";
  auto: boolean;
  value: number;
  onAutoChange: (auto: boolean) => void;
  onChange: (value: number) => void;
}> = ({ id, side, auto, value, onAutoChange, onChange }) => {
  const letter = side === "width" ? "W" : "H";
  const autoName = side === "width" ? "Fill" : "Hug";
  const autoHint =
    side === "width" ? "Auto width: fills the parent" : "Auto height: hugs the contents";
  const Icon = side === "width" ? UnfoldHorizontal : FoldVertical;
  return (
    <div className="flex min-w-0 gap-1">
      {auto ? (
        <div
          title={autoHint}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-input bg-input/30 pl-1.5 text-xs text-muted-foreground"
        >
          <Letter>{letter}</Letter>
          <span className="truncate">{autoName}</span>
        </div>
      ) : (
        <NumberProp
          id={id}
          label={side === "width" ? "Width" : "Height"}
          prefix={<Letter>{letter}</Letter>}
          property={`style.${side}`}
          min={1}
          unit="px"
          value={value}
          onChange={onChange}
          className="flex-1"
        />
      )}
      <button
        type="button"
        aria-pressed={auto}
        title={auto ? `${autoHint} (click for a fixed ${side})` : autoHint}
        aria-label={side === "width" ? "Auto width" : "Auto height"}
        onClick={() => onAutoChange(!auto)}
        className={cn(
          "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3.5",
          auto && "bg-accent text-primary dark:text-ring"
        )}
      >
        <Icon />
      </button>
    </div>
  );
};

export const ContainerEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: ContainerStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);

  const autoWidth = style.autoWidth !== false;
  const autoHeight = style.autoHeight !== false;

  // Switching an automatic side off keeps the size the container has right now.
  const setAuto = (side: "width" | "height", auto: boolean) => {
    const key = side === "width" ? "autoWidth" : "autoHeight";
    if (auto) return update({ [key]: true });
    const box = document.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(element.id)}"]`)
      ?.firstElementChild as HTMLElement | null | undefined;
    const measured = side === "width" ? box?.offsetWidth : box?.offsetHeight;
    update({
      [key]: false,
      [side]:
        style[side] ??
        (measured || (side === "width" ? DEFAULT_CONTAINER_WIDTH : DEFAULT_CONTAINER_HEIGHT)),
    });
  };

  const row = isRowDirection(style.flexDirection);
  const id = (name: string) => `${element.id}-container-${name}`;
  const pixels = (key: "gap" | "paddingX" | "paddingY") =>
    typeof style[key] === "number" ? style[key] : 0;

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          <SideField
            id={id("width")}
            side="width"
            auto={autoWidth}
            value={style.width ?? DEFAULT_CONTAINER_WIDTH}
            onAutoChange={(auto) => setAuto("width", auto)}
            onChange={(width) => update({ width })}
          />
          <SideField
            id={id("height")}
            side="height"
            auto={autoHeight}
            value={style.height ?? DEFAULT_CONTAINER_HEIGHT}
            onAutoChange={(auto) => setAuto("height", auto)}
            onChange={(height) => update({ height })}
          />
        </FieldGrid>
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
