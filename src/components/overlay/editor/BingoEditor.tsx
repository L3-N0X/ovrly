import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { type BingoStyle, type PrismaElement } from "@/lib/types";
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  BetweenHorizontalStart,
  Columns3,
  ImageIcon,
  Loader2,
  Percent,
  Rows3,
  Scan,
  SquareRoundCorner,
  Trash2,
} from "lucide-react";
import { uploadImage } from "@/lib/uploads";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BindableField } from "@/components/variables/BindableField";
import { cn } from "@/lib/utils";
import {
  BINGO_BORDER_RADIUS_RANGE,
  BINGO_BORDER_WIDTH_RANGE,
  BINGO_CROSS_THICKNESS_RANGE,
  BINGO_FONT_SIZE_RANGE,
  BINGO_GAP_RANGE,
  BINGO_GRID_LINE_WIDTH_RANGE,
  BINGO_IMAGE_FITS,
  BINGO_MAX_FIELD_LENGTH,
  BINGO_PADDING_RANGE,
  BINGO_PERCENT_RANGE,
  BINGO_SIZE_RANGE,
  bingoSizes,
  hasBingoMiddle,
  normalizeBingoData,
  resolveBingoStyle,
  type BingoCrossStyle,
  type BingoDataUpdate,
  type BingoImageFit,
  type ResolvedBingoStyle,
} from "@/lib/bingo";
import {
  ColorProp,
  EffectsSection,
  FieldGrid,
  FieldHint,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  SMALL_CONTROL,
  StrokeSection,
  StrokeWidthIcon,
  TextSection,
} from "./fields";
import { useStyleDraft } from "./useStyleDraft";

const SizeSelect: React.FC<{
  id: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ id, label, icon, value, disabled, onChange }) => (
  <Select
    value={String(value)}
    disabled={disabled}
    onValueChange={(raw) => {
      const next = Number.parseInt(raw, 10);
      if (Number.isInteger(next) && next !== value) onChange(next);
    }}
  >
    <SelectTrigger id={id} aria-label={label} title={label} className={SMALL_CONTROL}>
      <span className="flex items-center gap-1.5 [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
        {icon}
        <SelectValue />
      </span>
    </SelectTrigger>
    <SelectContent>
      {bingoSizes.map((option) => (
        <SelectItem key={option} value={String(option)}>
          {option} {label.toLowerCase()}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const imageFitLabels: Record<BingoImageFit, string> = {
  cover: "Cover",
  contain: "Contain",
  fill: "Stretch",
};

/** Upload, replace or remove the image behind the cells. */
const BackgroundImageControl: React.FC<{
  id: string;
  value: string | undefined;
  onChange: (url: string | undefined) => void;
}> = ({ id, value, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload the image");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-1">
      <BindableField compact property="style.backgroundImage" label="Background image">
        <div className="flex items-center gap-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary">
            {value ? (
              <img src={value} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="size-3.5 text-muted-foreground" />
            )}
          </div>
          <Button
            id={id}
            type="button"
            variant="secondary"
            className={cn("flex-1", SMALL_CONTROL)}
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading && <Loader2 className="size-3.5 animate-spin" />}
            {isUploading ? "Uploading..." : value ? "Replace image" : "Add background image"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove background image"
              title="Remove background image"
              onClick={() => onChange(undefined)}
            >
              <Trash2 />
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>
      </BindableField>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export const BingoEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: BingoStyle) => void;
  onDataChange?: (elementId: string, data: BingoDataUpdate) => void;
}> = ({ element, onChange, onDataChange }) => {
  // The free-middle switch as this user last set it, together with the server state it was set
  // against: it stays in front of the server's value until that state is replaced, which is how
  // it stops being an override. Derived rather than cleared in an effect, so a stale override
  // can't outlive the state it was based on.
  const [pendingFreeMiddle, setPendingFreeMiddle] = useState<{
    bingo: unknown;
    value: boolean;
  } | null>(null);

  const { style, update, colorProps } = useStyleDraft<BingoStyle>(
    element,
    onChange,
    resolveBingoStyle
  );
  // Every value is filled in by resolveBingoStyle.
  const resolved = style as ResolvedBingoStyle;

  const { rows, columns } = normalizeBingoData(element.bingo);
  // This user's choice wins until the server state it was made against is replaced.
  const freeMiddle =
    pendingFreeMiddle && pendingFreeMiddle.bingo === element.bingo
      ? pendingFreeMiddle.value
      : (element.bingo?.freeMiddle ?? false);
  const canUseFreeMiddle = hasBingoMiddle(rows, columns);

  const handleFreeMiddleChange = (checked: boolean) => {
    if (!onDataChange || !canUseFreeMiddle) return;
    setPendingFreeMiddle({ bingo: element.bingo, value: checked });
    onDataChange(element.id, { freeMiddle: checked });
  };

  const id = (name: string) => `${element.id}-bingo-${name}`;

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          <NumberProp
            id={id("width")}
            property="style.width"
            label="Width"
            prefix={<Letter>W</Letter>}
            unit="px"
            min={BINGO_SIZE_RANGE.min}
            max={BINGO_SIZE_RANGE.max}
            value={resolved.width}
            onChange={(width) => update({ width })}
          />
          <div
            title="Fields are always square, so the height follows from the width, rows and columns."
            className="flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-input bg-input/30 pl-1.5 text-xs text-muted-foreground"
          >
            <Letter>H</Letter>
            <span className="truncate">Auto</span>
          </div>
        </FieldGrid>
      </InspectorSection>

      <InspectorSection title="Grid">
        <FieldGrid>
          <SizeSelect
            id={id("rows")}
            label="Rows"
            icon={<Rows3 />}
            value={rows}
            disabled={!onDataChange}
            onChange={(next) => onDataChange?.(element.id, { rows: next })}
          />
          <SizeSelect
            id={id("columns")}
            label="Columns"
            icon={<Columns3 />}
            value={columns}
            disabled={!onDataChange}
            onChange={(next) => onDataChange?.(element.id, { columns: next })}
          />
        </FieldGrid>
        <div
          className="flex h-7 items-center space-x-2"
          title={canUseFreeMiddle ? undefined : "Needs an odd number of rows and columns."}
        >
          <Switch
            id={id("free-middle")}
            checked={freeMiddle && canUseFreeMiddle}
            onCheckedChange={handleFreeMiddleChange}
            disabled={!canUseFreeMiddle || !onDataChange}
          />
          <Label htmlFor={id("free-middle")} className="text-xs font-normal">
            Free middle
            {!canUseFreeMiddle && (
              <span className="text-muted-foreground">(needs odd rows and columns)</span>
            )}
          </Label>
        </div>
        <BindableField
          property="style.gridLines"
          label="Grid lines"
          htmlFor={id("grid-lines")}
          inline
        >
          <Switch
            id={id("grid-lines")}
            checked={resolved.gridLines}
            onCheckedChange={(gridLines) => update({ gridLines })}
          />
        </BindableField>
        {resolved.gridLines ? (
          <FieldGrid>
            <ColorProp
              id={id("grid-line-color")}
              property="style.gridLineColor"
              label="Grid line color"
              value={resolved.gridLineColor}
              onChange={(gridLineColor) => update({ gridLineColor })}
              {...colorProps}
            />
            <NumberProp
              id={id("grid-line-width")}
              property="style.gridLineWidth"
              label="Grid line width"
              prefix={<StrokeWidthIcon />}
              unit="px"
              min={BINGO_GRID_LINE_WIDTH_RANGE.min}
              max={BINGO_GRID_LINE_WIDTH_RANGE.max}
              value={resolved.gridLineWidth}
              onChange={(gridLineWidth) => update({ gridLineWidth })}
            />
          </FieldGrid>
        ) : (
          <FieldGrid>
            <NumberProp
              id={id("gap")}
              property="style.gap"
              label="Gap between fields"
              prefix={<BetweenHorizontalStart />}
              unit="px"
              min={BINGO_GAP_RANGE.min}
              max={BINGO_GAP_RANGE.max}
              value={resolved.gap}
              onChange={(gap) => update({ gap })}
            />
            <NumberProp
              id={id("padding")}
              property="style.padding"
              label="Padding"
              prefix={<Scan />}
              unit="px"
              min={BINGO_PADDING_RANGE.min}
              max={BINGO_PADDING_RANGE.max}
              value={resolved.padding}
              onChange={(padding) => update({ padding })}
            />
          </FieldGrid>
        )}
        <FieldHint>
          {resolved.gridLines
            ? "Lines run between all fields and meet the stroke, like a table. Give the stroke the same width and color for a uniform grid."
            : `Resizing keeps every field in its row and column. Labels are edited in Content (up to ${BINGO_MAX_FIELD_LENGTH} characters).`}
        </FieldHint>
      </InspectorSection>

      <InspectorSection title="Appearance">
        <FieldGrid>
          <NumberProp
            id={id("border-radius")}
            property="style.borderRadius"
            label="Corner radius"
            prefix={<SquareRoundCorner />}
            unit="px"
            min={BINGO_BORDER_RADIUS_RANGE.min}
            max={BINGO_BORDER_RADIUS_RANGE.max}
            value={resolved.borderRadius}
            onChange={(borderRadius) => update({ borderRadius })}
          />
        </FieldGrid>
      </InspectorSection>

      <TextSection
        id={id("text")}
        style={resolved}
        defaultFontSize={resolved.fontSize}
        fontSizeLabel="Max font size (labels shrink to fit their field)"
        fontSizeRange={BINGO_FONT_SIZE_RANGE}
        colorProps={colorProps}
        onChange={update}
      />

      <FillSection
        id={id("fill")}
        value={resolved.backgroundColor}
        optional={false}
        colorProps={colorProps}
        onChange={(backgroundColor) => update({ backgroundColor })}
      >
        <BackgroundImageControl
          id={id("background-image")}
          value={resolved.backgroundImage}
          onChange={(backgroundImage) => update({ backgroundImage })}
        />
        {resolved.backgroundImage && (
          <FieldGrid>
            <Select
              value={resolved.backgroundImageFit}
              onValueChange={(value) => update({ backgroundImageFit: value as BingoImageFit })}
            >
              <SelectTrigger
                id={id("background-image-fit")}
                aria-label="Image fit"
                title="Image fit"
                className={SMALL_CONTROL}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BINGO_IMAGE_FITS.map((fit) => (
                  <SelectItem key={fit} value={fit}>
                    {imageFitLabels[fit]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NumberProp
              id={id("background-image-opacity")}
              property="style.backgroundImageOpacity"
              label="Image opacity"
              prefix={<Percent />}
              unit="%"
              progress
              min={BINGO_PERCENT_RANGE.min}
              max={BINGO_PERCENT_RANGE.max}
              value={resolved.backgroundImageOpacity}
              onChange={(backgroundImageOpacity) => update({ backgroundImageOpacity })}
            />
          </FieldGrid>
        )}
      </FillSection>

      <StrokeSection
        id={id("stroke")}
        color={resolved.borderColor}
        width={resolved.borderWidth}
        range={BINGO_BORDER_WIDTH_RANGE}
        colorProps={colorProps}
        onChange={update}
      />

      <InspectorSection title="Cross">
        <FieldGrid className="items-center">
          <SegmentedControl<BingoCrossStyle>
            aria-label="Cross style"
            size="sm"
            stretch
            value={resolved.crossStyle}
            onValueChange={(crossStyle) => update({ crossStyle })}
            options={[
              { value: "brush", label: "Brush" },
              { value: "line", label: "Line" },
            ]}
          />
          <ColorProp
            id={id("cross-color")}
            property="style.checkedCrossColor"
            label="Cross color"
            value={resolved.checkedCrossColor}
            onChange={(checkedCrossColor) => update({ checkedCrossColor })}
            {...colorProps}
          />
          <NumberProp
            id={id("cross-thickness")}
            property="style.crossThickness"
            label="Cross thickness (percent of the field)"
            prefix={<Letter>T</Letter>}
            unit="%"
            progress
            min={BINGO_CROSS_THICKNESS_RANGE.min}
            max={BINGO_CROSS_THICKNESS_RANGE.max}
            value={resolved.crossThickness}
            onChange={(crossThickness) => update({ crossThickness })}
          />
          <NumberProp
            id={id("cross-opacity")}
            property="style.crossOpacity"
            label="Cross opacity"
            prefix={<Percent />}
            unit="%"
            progress
            min={BINGO_PERCENT_RANGE.min}
            max={BINGO_PERCENT_RANGE.max}
            value={resolved.crossOpacity}
            onChange={(crossOpacity) => update({ crossOpacity })}
          />
        </FieldGrid>
        <FieldHint>The cross is drawn behind the label, so marked fields stay readable.</FieldHint>
      </InspectorSection>

      <EffectsSection
        id={id("effects")}
        style={resolved}
        spread="available"
        colorProps={colorProps}
        onChange={update}
      />
    </>
  );
};
