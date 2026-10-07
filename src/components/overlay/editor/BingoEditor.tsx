import { Label } from "@/components/ui/label";
import { ColorField } from "@/components/ui/color-picker";
import { NumberField } from "@/components/ui/number-field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { type BingoStyle, type PrismaElement } from "@/lib/types";
import { fontWeightOf } from "@/lib/fonts";
import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { uploadImage } from "@/lib/uploads";
import { FontPicker } from "../../FontPicker";
import { FontWeightPicker } from "../../FontWeightPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
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
} from "@/lib/bingo";

/** A labelled number field. `unit` defaults to pixels. */
const NumberControl: React.FC<{
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ id, label, min, max, value, unit = "px", onChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <NumberField
      id={id}
      value={value}
      min={min}
      max={max}
      unit={unit}
      progress={unit === "%"}
      onChange={(next) => {
        if (next !== value) onChange(next);
      }}
    />
  </div>
);

const ColorControl: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (color: string) => void;
  onOpenChange: (open: boolean) => void;
}> = ({ id, label, ...props }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <ColorField id={id} {...props} />
  </div>
);

/** A titled group of controls. */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-4">
    <h4 className="text-sm font-semibold">{title}</h4>
    {children}
  </section>
);

const SizeSelect: React.FC<{
  id: string;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ id, label, value, disabled, onChange }) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <Select
      value={String(value)}
      disabled={disabled}
      onValueChange={(raw) => {
        const next = Number.parseInt(raw, 10);
        if (Number.isInteger(next) && next !== value) onChange(next);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {bingoSizes.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
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
    <div className="space-y-2">
      <Label htmlFor={id}>Background Image</Label>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-secondary">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <Button
          id={id}
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUploading ? "Uploading..." : value ? "Replace Image" : "Upload Image"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Remove background image"
            title="Remove background image"
            onClick={() => onChange(undefined)}
          >
            <Trash2 className="h-4 w-4" />
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
      {error && (
        <p role="alert" className="text-sm text-destructive">
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
  const [isPickingColor, setIsPickingColor] = useState(false);
  // The free-middle switch as this user last set it, together with the server state it was set
  // against: it stays in front of the server's value until that state is replaced, which is how
  // it stops being an override. Derived rather than cleared in an effect, so a stale override
  // can't outlive the state it was based on.
  const [pendingFreeMiddle, setPendingFreeMiddle] = useState<{ bingo: unknown; value: boolean } | null>(
    null
  );

  const bingoStyle = useMemo(
    () => resolveBingoStyle(element.style as BingoStyle | null),
    [element.style]
  );
  // Held while a colour picker is open, which would otherwise snap the swatch back mid-drag.
  const { value: style, setValue: setStyle } = useLocalCopy(bingoStyle, isPickingColor);

  // `onChange` updates the page's state, so it must not run inside a state updater, which
  // React calls while rendering.
  const handleStyleChange = (newStylePart: Partial<BingoStyle>) => {
    const updated = { ...style, ...newStylePart };
    setStyle(updated);
    onChange(updated);
  };

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
  const colorProps = { onOpenChange: setIsPickingColor };

  return (
    <div className="space-y-6">
      <Section title="Card">
        <div className="grid grid-cols-2 gap-4">
          <SizeSelect
            id={id("rows")}
            label="Rows"
            value={rows}
            disabled={!onDataChange}
            onChange={(next) => onDataChange?.(element.id, { rows: next })}
          />
          <SizeSelect
            id={id("columns")}
            label="Columns"
            value={columns}
            disabled={!onDataChange}
            onChange={(next) => onDataChange?.(element.id, { columns: next })}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Switch
              id={id("free-middle")}
              checked={freeMiddle && canUseFreeMiddle}
              onCheckedChange={handleFreeMiddleChange}
              disabled={!canUseFreeMiddle || !onDataChange}
            />
            <Label htmlFor={id("free-middle")}>Free Middle</Label>
          </div>
          {!canUseFreeMiddle && (
            <p className="text-xs text-muted-foreground">Needs an odd number of rows and columns.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Resizing keeps every field in its row and column. Field labels are edited in the
          Content section, and are limited to {BINGO_MAX_FIELD_LENGTH} characters.
        </p>
        <NumberControl
          id={id("width")}
          label="Width"
          min={BINGO_SIZE_RANGE.min}
          max={BINGO_SIZE_RANGE.max}
          value={style.width}
          onChange={(width) => handleStyleChange({ width })}
        />
        <p className="text-xs text-muted-foreground">
          Fields are always square, so the height follows from the width, rows and columns.
        </p>
      </Section>

      <Section title="Text">
        <div className="space-y-2">
          <Label htmlFor={id("font-family")}>Font Family</Label>
          <FontPicker
            id={id("font-family")}
            value={style.fontFamily || ""}
            weight={fontWeightOf(style)}
            onChange={(fontFamily) => handleStyleChange({ fontFamily })}
          />
        </div>
        <NumberControl
          id={id("font-size")}
          label="Max Font Size"
          min={BINGO_FONT_SIZE_RANGE.min}
          max={BINGO_FONT_SIZE_RANGE.max}
          value={style.fontSize}
          onChange={(fontSize) => handleStyleChange({ fontSize })}
        />
        <p className="text-xs text-muted-foreground">
          Labels are as large as their cell allows, up to this size, and only wrap between words.
        </p>
        <div className="space-y-2">
          <Label htmlFor={id("font-weight")}>Font Weight</Label>
          <FontWeightPicker
            id={id("font-weight")}
            value={fontWeightOf(style)}
            onChange={(fontWeight) => handleStyleChange({ fontWeight })}
          />
        </div>
        <ColorControl
          id={id("color")}
          label="Text Color"
          value={style.color}
          onChange={(color) => handleStyleChange({ color })}
          {...colorProps}
        />
      </Section>

      <Section title="Background">
        <ColorControl
          id={id("background")}
          label="Background Color"
          value={style.backgroundColor}
          onChange={(backgroundColor) => handleStyleChange({ backgroundColor })}
          {...colorProps}
        />
        <BackgroundImageControl
          id={id("background-image")}
          value={style.backgroundImage}
          onChange={(backgroundImage) => handleStyleChange({ backgroundImage })}
        />
        {style.backgroundImage && (
          <>
            <div className="space-y-2">
              <Label htmlFor={id("background-image-fit")}>Image Fit</Label>
              <Select
                value={style.backgroundImageFit}
                onValueChange={(value) =>
                  handleStyleChange({ backgroundImageFit: value as BingoImageFit })
                }
              >
                <SelectTrigger id={id("background-image-fit")} className="w-full">
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
            </div>
            <NumberControl
              id={id("background-image-opacity")}
              label="Image Opacity"
              unit="%"
              min={BINGO_PERCENT_RANGE.min}
              max={BINGO_PERCENT_RANGE.max}
              value={style.backgroundImageOpacity}
              onChange={(backgroundImageOpacity) => handleStyleChange({ backgroundImageOpacity })}
            />
          </>
        )}
      </Section>

      <Section title="Borders">
        <ColorControl
          id={id("border-color")}
          label="Outline Color"
          value={style.borderColor}
          onChange={(borderColor) => handleStyleChange({ borderColor })}
          {...colorProps}
        />
        <NumberControl
          id={id("border-width")}
          label="Outline Width"
          min={BINGO_BORDER_WIDTH_RANGE.min}
          max={BINGO_BORDER_WIDTH_RANGE.max}
          value={style.borderWidth}
          onChange={(borderWidth) => handleStyleChange({ borderWidth })}
        />
        <NumberControl
          id={id("border-radius")}
          label="Corner Radius"
          min={BINGO_BORDER_RADIUS_RANGE.min}
          max={BINGO_BORDER_RADIUS_RANGE.max}
          value={style.borderRadius}
          onChange={(borderRadius) => handleStyleChange({ borderRadius })}
        />
        <div className="flex items-center space-x-2">
          <Switch
            id={id("grid-lines")}
            checked={style.gridLines}
            onCheckedChange={(gridLines) => handleStyleChange({ gridLines })}
          />
          <Label htmlFor={id("grid-lines")}>Grid Lines</Label>
        </div>
        {style.gridLines ? (
          <>
            <ColorControl
              id={id("grid-line-color")}
              label="Grid Line Color"
              value={style.gridLineColor}
              onChange={(gridLineColor) => handleStyleChange({ gridLineColor })}
              {...colorProps}
            />
            <NumberControl
              id={id("grid-line-width")}
              label="Grid Line Width"
              min={BINGO_GRID_LINE_WIDTH_RANGE.min}
              max={BINGO_GRID_LINE_WIDTH_RANGE.max}
              value={style.gridLineWidth}
              onChange={(gridLineWidth) => handleStyleChange({ gridLineWidth })}
            />
            <p className="text-xs text-muted-foreground">
              Lines run between all fields and meet the outline, like a table. Give the outline
              the same width and color for a uniform grid.
            </p>
          </>
        ) : (
          <>
            <NumberControl
              id={id("gap")}
              label="Gap"
              min={BINGO_GAP_RANGE.min}
              max={BINGO_GAP_RANGE.max}
              value={style.gap}
              onChange={(gap) => handleStyleChange({ gap })}
            />
            <NumberControl
              id={id("padding")}
              label="Padding"
              min={BINGO_PADDING_RANGE.min}
              max={BINGO_PADDING_RANGE.max}
              value={style.padding}
              onChange={(padding) => handleStyleChange({ padding })}
            />
          </>
        )}
      </Section>

      <Section title="Cross">
        <div className="space-y-2">
          <Label>Style</Label>
          <SegmentedControl<BingoCrossStyle>
            aria-label="Cross style"
            value={style.crossStyle}
            onValueChange={(crossStyle) => handleStyleChange({ crossStyle })}
            options={[
              { value: "brush", label: "Brush" },
              { value: "line", label: "Line" },
            ]}
          />
        </div>
        <ColorControl
          id={id("cross-color")}
          label="Cross Color"
          value={style.checkedCrossColor}
          onChange={(checkedCrossColor) => handleStyleChange({ checkedCrossColor })}
          {...colorProps}
        />
        <NumberControl
          id={id("cross-thickness")}
          label="Cross Thickness"
          unit="%"
          min={BINGO_CROSS_THICKNESS_RANGE.min}
          max={BINGO_CROSS_THICKNESS_RANGE.max}
          value={style.crossThickness}
          onChange={(crossThickness) => handleStyleChange({ crossThickness })}
        />
        <NumberControl
          id={id("cross-opacity")}
          label="Cross Opacity"
          unit="%"
          min={BINGO_PERCENT_RANGE.min}
          max={BINGO_PERCENT_RANGE.max}
          value={style.crossOpacity}
          onChange={(crossOpacity) => handleStyleChange({ crossOpacity })}
        />
        <p className="text-xs text-muted-foreground">
          The cross is drawn behind the label, so marked fields stay readable.
        </p>
      </Section>
    </div>
  );
};
