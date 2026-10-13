import React from "react";
import {
  ALargeSmall,
  Expand,
  FoldHorizontal,
  FoldVertical,
  Minus,
  Plus,
  Ruler,
  SquareRoundCorner,
  Sun,
  UnfoldHorizontal,
  UnfoldVertical,
} from "lucide-react";
import { ColorField } from "@/components/ui/color-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NumberField } from "@/components/ui/number-field";
import { BindableField } from "@/components/variables/BindableField";
import { fontWeightOf } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import {
  BORDER_RADIUS_RANGE,
  BORDER_WIDTH_RANGE,
  DEFAULT_BORDER_COLOR,
  DEFAULT_SHADOW,
  SHADOW_BLUR_RANGE,
  type BaseElementStyle,
} from "@/lib/types";
import { FontPicker } from "../../FontPicker";
import { FontWeightPicker } from "../../FontWeightPicker";
import { FIXED_OR_FILL, fixedOrFill, sizeModePatch, type SizeMode } from "./sizing";

// The building blocks of the inspector, laid out like Figma's: titled sections in a fixed order
// (Position, Layout, Appearance, Text, Fill, Stroke, Effects, with an element's own sections in
// between), two small fields to a row, and number fields that carry their label inside ("X",
// "W", an icon) with the full name as their tooltip. Sections whose property can be absent
// (fill, stroke, shadow) add and remove it with a + / − in their header.

export const InspectorSection: React.FC<{
  title: string;
  // A button in the header, usually a SectionAction.
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}> = ({ title, action, className, children }) => (
  <section className={cn("border-b px-3 py-2.5", className)}>
    <div className="flex h-6 items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold tracking-wide">{title}</h3>
      {action}
    </div>
    {React.Children.toArray(children).length > 0 && <div className="mt-1.5 space-y-2">{children}</div>}
  </section>
);

export const SectionAction: React.FC<{
  kind: "add" | "remove";
  label: string;
  onClick: () => void;
}> = ({ kind, label, onClick }) => {
  const Icon = kind === "add" ? Plus : Minus;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="-mr-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="size-3.5" />
    </button>
  );
};

// Two fields side by side, which is as many as fit without crowding.
export const FieldGrid: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => <div className={cn("grid grid-cols-2 gap-2", className)}>{children}</div>;

// A control with a small caption above it, for the ones that can't carry their label inside
// (dropdowns, segmented controls).
export const Field: React.FC<{
  label: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, className, children }) => (
  <div className={cn("min-w-0 space-y-1", className)}>
    <label htmlFor={htmlFor} className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

// A short note under a group of fields.
export const FieldHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>
);

// The classes that make dropdowns and buttons as tall as the inspector's number fields.
export const SMALL_CONTROL = "h-7 px-2 text-xs";

// The letter a number field shows in front of its value.
export const Letter: React.FC<{ children: string }> = ({ children }) => (
  <span className="w-3 text-center text-[11px] font-medium">{children}</span>
);

/**
 * A small number field with its label inside: `prefix` is shown in front of the value, `label`
 * is its tooltip and accessible name. With `property` (as lib/bindings.ts names it) it can be
 * bound to a number variable. Without `min`, negative values are allowed too.
 */
export const NumberProp: React.FC<{
  id: string;
  label: string;
  prefix: React.ReactNode;
  property?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  progress?: boolean;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}> = ({ id, label, prefix, property, value, onChange, className, ...props }) => (
  <BindableField compact property={property} label={label} prefix={prefix} className={className}>
    <NumberField
      id={id}
      aria-label={label}
      size="sm"
      stepper={false}
      prefix={prefix}
      value={value}
      onChange={(next) => {
        if (next !== value) onChange(next);
      }}
      {...props}
    />
  </BindableField>
);

/**
 * A small colour field. `value` is empty for "none"; with `onClear` the colour can be removed
 * from inside the field. With `property` it can be bound to a color variable.
 */
export const ColorProp: React.FC<{
  id: string;
  label: string;
  property?: string;
  value: string;
  /** Where the picker starts when `value` is empty. */
  defaultColor?: string;
  className?: string;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onClear?: () => void;
}> = ({ id, label, property, className, ...props }) => (
  <BindableField compact property={property} label={label} className={className}>
    <ColorField id={id} aria-label={label} size="sm" {...props} />
  </BindableField>
);

type ColorProps = { onOpenChange: (open: boolean) => void };

/** The corner radius of anything with corners. `property` names the key it is stored under. */
export const CornerRadiusProp: React.FC<{
  id: string;
  property: "radius" | "borderRadius";
  value: number;
  onChange: (value: number) => void;
}> = ({ id, property, value, onChange }) => (
  <NumberProp
    id={id}
    label="Corner radius"
    prefix={<SquareRoundCorner />}
    property={`style.${property}`}
    unit="px"
    min={BORDER_RADIUS_RANGE.min}
    max={BORDER_RADIUS_RANGE.max}
    value={value}
    onChange={onChange}
  />
);

/** Font, weight, size and colour of an element's text. */
export const TextSection: React.FC<{
  id: string;
  style: BaseElementStyle;
  defaultFontSize: number;
  // Shown in the font list's previews.
  previewWord?: string;
  fontSizeLabel?: string;
  fontSizeRange?: { min: number; max: number };
  colorProps: ColorProps;
  onChange: (patch: Partial<BaseElementStyle>) => void;
  // Fields of the element's own, shown first.
  children?: React.ReactNode;
}> = ({
  id,
  style,
  defaultFontSize,
  previewWord,
  fontSizeLabel = "Font size",
  fontSizeRange,
  colorProps,
  onChange,
  children,
}) => (
  <InspectorSection title="Text">
    {children}
    <FontPicker
      id={`${id}-font-family`}
      value={style.fontFamily || ""}
      weight={fontWeightOf(style)}
      onChange={(fontFamily) => onChange({ fontFamily })}
      previewWord={previewWord}
      className={cn("w-full font-normal", SMALL_CONTROL)}
    />
    <FieldGrid>
      <FontWeightPicker
        id={`${id}-font-weight`}
        value={fontWeightOf(style)}
        onChange={(fontWeight) => onChange({ fontWeight })}
        className={SMALL_CONTROL}
      />
      <NumberProp
        id={`${id}-font-size`}
        label={fontSizeLabel}
        prefix={<ALargeSmall />}
        property="style.fontSize"
        min={fontSizeRange?.min ?? 1}
        max={fontSizeRange?.max}
        unit="px"
        value={typeof style.fontSize === "number" ? style.fontSize : defaultFontSize}
        onChange={(fontSize) => onChange({ fontSize })}
      />
    </FieldGrid>
    <ColorProp
      id={`${id}-color`}
      label="Text color"
      property="style.color"
      value={style.color || "#ffffff"}
      onChange={(color) => onChange({ color })}
      {...colorProps}
    />
  </InspectorSection>
);

/**
 * The background of an element. Optional ones (`optional`) start empty and are added and removed
 * from the header; others always have a colour.
 */
export const FillSection: React.FC<{
  id: string;
  value: string | undefined;
  defaultColor?: string;
  optional?: boolean;
  property?: string;
  label?: string;
  colorProps: ColorProps;
  onChange: (value: string | undefined) => void;
  children?: React.ReactNode;
}> = ({
  id,
  value,
  defaultColor = "#000000",
  optional = true,
  property = "style.backgroundColor",
  label = "Fill",
  colorProps,
  onChange,
  children,
}) => {
  const filled = !!value;
  return (
    <InspectorSection
      title="Fill"
      action={
        optional && (
          <SectionAction
            kind={filled ? "remove" : "add"}
            label={filled ? "Remove fill" : "Add fill"}
            onClick={() => onChange(filled ? undefined : defaultColor)}
          />
        )
      }
    >
      {(filled || !optional) && (
        <ColorProp
          id={`${id}-fill`}
          label={label}
          property={property}
          value={value || defaultColor}
          defaultColor={defaultColor}
          onChange={onChange}
          {...colorProps}
        />
      )}
      {children}
    </InspectorSection>
  );
};

/** An outline, drawn only while its width is above 0. Adding one draws it 2px wide. */
export const StrokeSection: React.FC<{
  id: string;
  color: string | undefined;
  width: number;
  defaultColor?: string;
  range?: { min: number; max: number };
  colorProps: ColorProps;
  onChange: (patch: { borderColor?: string; borderWidth?: number }) => void;
}> = ({
  id,
  color,
  width,
  defaultColor = DEFAULT_BORDER_COLOR,
  range = BORDER_WIDTH_RANGE,
  colorProps,
  onChange,
}) => {
  const stroked = width > 0;
  return (
    <InspectorSection
      title="Stroke"
      action={
        <SectionAction
          kind={stroked ? "remove" : "add"}
          label={stroked ? "Remove stroke" : "Add stroke"}
          onClick={() => onChange({ borderWidth: stroked ? 0 : Math.max(range.min, 2) })}
        />
      }
    >
      {stroked && (
        <FieldGrid>
          <ColorProp
            id={`${id}-stroke-color`}
            label="Stroke color"
            property="style.borderColor"
            value={color || defaultColor}
            defaultColor={defaultColor}
            onChange={(borderColor) => onChange({ borderColor })}
            {...colorProps}
          />
          <NumberProp
            id={`${id}-stroke-width`}
            label="Stroke width"
            prefix={<StrokeWidthIcon />}
            property="style.borderWidth"
            min={range.min}
            max={range.max}
            unit="px"
            value={width}
            onChange={(borderWidth) => onChange({ borderWidth })}
          />
        </FieldGrid>
      )}
    </InspectorSection>
  );
};

// Three lines of growing thickness, like Figma's stroke weight.
export const StrokeWidthIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="2" y="3" width="12" height="1" rx="0.5" />
    <rect x="2" y="7" width="12" height="2" rx="1" />
    <rect x="2" y="11.5" width="12" height="3" rx="1.5" />
  </svg>
);

const SHADOW_KEYS = ["shadowColor", "shadowX", "shadowY", "shadowBlur", "shadowSpread"] as const;

/**
 * The drop shadow, which every element can have. `spread` is for elements with a fill: their
 * shadow is cast by their box, while anything else casts it from what it draws, which can't
 * spread (see components/overlay/shadow.ts).
 */
export const EffectsSection: React.FC<{
  id: string;
  style: BaseElementStyle;
  spread?: "available" | "needs-fill";
  colorProps: ColorProps;
  onChange: (patch: Partial<BaseElementStyle>) => void;
}> = ({ id, style, spread, colorProps, onChange }) => {
  const shadowed = !!style.shadowColor;
  const number = (key: (typeof SHADOW_KEYS)[number]) => {
    const value = style[key];
    return typeof value === "number" ? value : (DEFAULT_SHADOW[key] as number);
  };
  return (
    <InspectorSection
      title="Effects"
      action={
        <SectionAction
          kind={shadowed ? "remove" : "add"}
          label={shadowed ? "Remove drop shadow" : "Add drop shadow"}
          onClick={() =>
            onChange(
              shadowed
                ? Object.fromEntries(SHADOW_KEYS.map((key) => [key, undefined]))
                : { ...DEFAULT_SHADOW }
            )
          }
        />
      }
    >
      {shadowed && (
        <>
          <Field label="Drop shadow">
            <ColorProp
              id={`${id}-shadow-color`}
              label="Shadow color"
              property="style.shadowColor"
              value={style.shadowColor || DEFAULT_SHADOW.shadowColor}
              defaultColor={DEFAULT_SHADOW.shadowColor}
              onChange={(shadowColor) => onChange({ shadowColor })}
              {...colorProps}
            />
          </Field>
          <FieldGrid>
            <NumberProp
              id={`${id}-shadow-x`}
              label="Shadow X offset"
              prefix={<Letter>X</Letter>}
              property="style.shadowX"
              unit="px"
              value={number("shadowX")}
              onChange={(shadowX) => onChange({ shadowX })}
            />
            <NumberProp
              id={`${id}-shadow-y`}
              label="Shadow Y offset"
              prefix={<Letter>Y</Letter>}
              property="style.shadowY"
              unit="px"
              value={number("shadowY")}
              onChange={(shadowY) => onChange({ shadowY })}
            />
            <NumberProp
              id={`${id}-shadow-blur`}
              label="Blur"
              prefix={<Sun />}
              property="style.shadowBlur"
              min={SHADOW_BLUR_RANGE.min}
              max={SHADOW_BLUR_RANGE.max}
              unit="px"
              value={number("shadowBlur")}
              onChange={(shadowBlur) => onChange({ shadowBlur })}
            />
            {spread && (
              <NumberProp
                id={`${id}-shadow-spread`}
                label={
                  spread === "available" ? "Spread" : "Spread (only drawn while there is a fill)"
                }
                prefix={<Expand />}
                property="style.shadowSpread"
                unit="px"
                disabled={spread === "needs-fill"}
                value={number("shadowSpread")}
                onChange={(shadowSpread) => onChange({ shadowSpread })}
              />
            )}
          </FieldGrid>
        </>
      )}
    </InspectorSection>
  );
};

/** Width and height in pixels, both bindable. */
export const SizeFields: React.FC<{
  id: string;
  width: number;
  height: number;
  min?: number;
  onChange: (patch: { width?: number; height?: number }) => void;
}> = ({ id, width, height, min = 1, onChange }) => (
  <FieldGrid>
    <NumberProp
      id={`${id}-width`}
      label="Width"
      prefix={<Letter>W</Letter>}
      property="style.width"
      min={min}
      unit="px"
      value={width}
      onChange={(width) => onChange({ width })}
    />
    <NumberProp
      id={`${id}-height`}
      label="Height"
      prefix={<Letter>H</Letter>}
      property="style.height"
      min={min}
      unit="px"
      value={height}
      onChange={(height) => onChange({ height })}
    />
  </FieldGrid>
);

const SIZE_MODE_LABELS: Record<SizeMode, string> = {
  fixed: "Fixed size",
  hug: "Hug contents",
  fill: "Fill container",
};

const SIZE_MODE_ICONS = {
  width: { fixed: Ruler, hug: FoldHorizontal, fill: UnfoldHorizontal },
  height: { fixed: Ruler, hug: FoldVertical, fill: UnfoldVertical },
} as const;

/**
 * One side of an element's size: the pixel count while it is fixed (bindable), otherwise the
 * name of its mode, and a menu next to it to switch between the `modes` the element offers.
 */
export const SizeProp: React.FC<{
  id: string;
  side: "width" | "height";
  modes: readonly SizeMode[];
  mode: SizeMode;
  onModeChange: (mode: SizeMode) => void;
  /** Only needed when the side can be fixed. */
  value?: number;
  min?: number;
  onChange?: (value: number) => void;
}> = ({ id, side, modes, mode, onModeChange, value, min = 1, onChange }) => {
  const letter = side === "width" ? "W" : "H";
  const Icon = SIZE_MODE_ICONS[side][mode];
  return (
    <div className="flex min-w-0 gap-1">
      {mode === "fixed" && value !== undefined && onChange ? (
        <NumberProp
          id={id}
          label={side === "width" ? "Width" : "Height"}
          prefix={<Letter>{letter}</Letter>}
          property={`style.${side}`}
          min={min}
          unit="px"
          value={value}
          onChange={onChange}
          className="flex-1"
        />
      ) : (
        <div
          title={SIZE_MODE_LABELS[mode]}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-input bg-input/30 pl-1.5 text-xs text-muted-foreground"
        >
          <Letter>{letter}</Letter>
          <span className="truncate">{mode === "hug" ? "Hug" : "Fill"}</span>
        </div>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={`${side === "width" ? "Width" : "Height"}: ${SIZE_MODE_LABELS[mode]}`}
            aria-label={`${side === "width" ? "Width" : "Height"} sizing`}
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent [&_svg]:size-3.5"
          >
            <Icon />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={(next) => onModeChange(next as SizeMode)}
          >
            {modes.map((option) => {
              const OptionIcon = SIZE_MODE_ICONS[side][option];
              return (
                <DropdownMenuRadioItem key={option} value={option} className="text-xs">
                  <OptionIcon className="size-3.5" />
                  {SIZE_MODE_LABELS[option]}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

/**
 * Width and height with a sizing mode each (see sizing.ts): fixed pixels, hugging the content or
 * filling the parent. By default fixed or fill; `hugKey` lists the style keys of elements that
 * store hugging (containers), which then offer all three.
 */
export const SizeModeFields: React.FC<{
  elementId: string;
  style: { width?: number; height?: number; fillWidth?: boolean; fillHeight?: boolean };
  defaultSize: { width: number; height: number };
  modes?: readonly SizeMode[];
  hugKeys?: { width: string; height: string };
  /** Every side that doesn't fill hugs (elements sized by their content as a whole). */
  hugging?: boolean;
  min?: number;
  onChange: (patch: Record<string, unknown>) => void;
}> = ({ elementId, style, defaultSize, modes = FIXED_OR_FILL, hugKeys, hugging, min, onChange }) => {
  const modeOf = (side: "width" | "height"): SizeMode => {
    const fill = fixedOrFill(style, side);
    if (fill === "fill") return fill;
    if (hugging) return "hug";
    if (!hugKeys) return fill;
    return (style as Record<string, unknown>)[hugKeys[side]] === true ? "hug" : "fixed";
  };
  return (
    <FieldGrid>
      {(["width", "height"] as const).map((side) => (
        <SizeProp
          key={side}
          id={`${elementId}-${side}`}
          side={side}
          modes={modes}
          mode={modeOf(side)}
          onModeChange={(mode) =>
            onChange(
              sizeModePatch(elementId, style, side, mode, defaultSize[side], hugKeys?.[side])
            )
          }
          min={min}
          value={style[side] ?? defaultSize[side]}
          onChange={(value) => onChange({ [side]: value })}
        />
      ))}
    </FieldGrid>
  );
};
