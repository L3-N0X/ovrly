import * as React from "react";
import { Check, Copy, Pipette, X } from "lucide-react";

import { NumberField } from "@/components/ui/number-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  hsvaToHex,
  hsvaToRgba,
  normalizeColor,
  oklabToOklch,
  oklabToRgb,
  oklchToOklab,
  parseColor,
  rgbToOklab,
  rgbaToHex,
  rgbaToHsva,
  type Hsva,
  type Oklab,
  type Oklch,
} from "@/lib/color";
import { addRecentColor, useRecentColors } from "@/lib/colorHistory";
import { cn } from "@/lib/utils";

type ChangeHandler = (hsva: Hsva, commit?: boolean) => void;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const toHsva = (value: string, previous?: Hsva): Hsva => {
  const rgba = parseColor(value);
  return rgba ? rgbaToHsva(rgba, previous) : { h: 0, s: 0, v: 1, a: 1 };
};

const opaque = (hsva: Hsva) => hsvaToHex({ ...hsva, a: 1 });

// --- Formats ---

type ColorFormat = "hex" | "rgb" | "hsv" | "oklch" | "oklab";

const FORMATS: { value: ColorFormat; label: string }[] = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsv", label: "HSV" },
  { value: "oklch", label: "OKLCH" },
  { value: "oklab", label: "OKLAB" },
];

const FORMAT_KEY = "ovrly:color-format";

const loadFormat = (): ColorFormat => {
  try {
    const stored = localStorage.getItem(FORMAT_KEY);
    return FORMATS.some((format) => format.value === stored) ? (stored as ColorFormat) : "hex";
  } catch {
    return "hex";
  }
};

interface Channel {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  apply: (value: number) => Hsva;
}

// The three fields of a format besides alpha. Each turns its new value back into HSV, which is
// what the picker keeps, so switching formats never loses anything.
const channelsFor = (format: ColorFormat, hsva: Hsva): Channel[] => {
  const rgba = hsvaToRgba(hsva);
  switch (format) {
    case "rgb": {
      const rounded = {
        r: Math.round(rgba.r),
        g: Math.round(rgba.g),
        b: Math.round(rgba.b),
        a: hsva.a,
      };
      return (["r", "g", "b"] as const).map((key) => ({
        label: key.toUpperCase(),
        value: rounded[key],
        min: 0,
        max: 255,
        step: 1,
        apply: (value) => rgbaToHsva({ ...rounded, [key]: value }, hsva),
      }));
    }
    case "hsv":
      return [
        { label: "H", value: hsva.h, min: 0, max: 360, step: 1, apply: (h) => ({ ...hsva, h }) },
        {
          label: "S",
          value: hsva.s * 100,
          min: 0,
          max: 100,
          step: 1,
          apply: (s) => ({ ...hsva, s: s / 100 }),
        },
        {
          label: "V",
          value: hsva.v * 100,
          min: 0,
          max: 100,
          step: 1,
          apply: (v) => ({ ...hsva, v: v / 100 }),
        },
      ];
    case "oklch": {
      const lch = oklabToOklch(rgbToOklab(rgba));
      const set = (patch: Partial<Oklch>) =>
        rgbaToHsva(oklabToRgb(oklchToOklab({ ...lch, ...patch }), hsva.a), hsva);
      return [
        {
          label: "L",
          value: lch.l * 100,
          min: 0,
          max: 100,
          step: 1,
          precision: 1,
          apply: (l) => set({ l: l / 100 }),
        },
        {
          label: "C",
          value: lch.c,
          min: 0,
          max: 0.4,
          step: 0.005,
          precision: 3,
          apply: (c) => set({ c }),
        },
        { label: "H", value: lch.h, min: 0, max: 360, step: 1, apply: (h) => set({ h }) },
      ];
    }
    case "oklab": {
      const lab = rgbToOklab(rgba);
      const set = (patch: Partial<Oklab>) => rgbaToHsva(oklabToRgb({ ...lab, ...patch }, hsva.a), hsva);
      const axis = (key: "a" | "b"): Channel => ({
        label: key,
        value: lab[key],
        min: -0.4,
        max: 0.4,
        step: 0.005,
        precision: 3,
        apply: (value) => set({ [key]: value }),
      });
      return [
        {
          label: "L",
          value: lab.l * 100,
          min: 0,
          max: 100,
          step: 1,
          precision: 1,
          apply: (l) => set({ l: l / 100 }),
        },
        axis("a"),
        axis("b"),
      ];
    }
    case "hex":
      return [];
  }
};

// --- Pointer surfaces ---

// Drives a surface with the pointer: every move is a live change, the release commits.
const pointerDrag = (onPoint: (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => void) => ({
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPoint(event, false);
  },
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) onPoint(event, false);
  },
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onPoint(event, true);
  },
});

const THUMB =
  "pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.25),0_1px_3px_rgb(0_0_0/0.35)]";

const keyDelta = (event: React.KeyboardEvent, horizontal = true) => {
  const amount = event.shiftKey ? 10 : 1;
  switch (event.key) {
    case "ArrowRight":
      return horizontal ? amount : 0;
    case "ArrowLeft":
      return horizontal ? -amount : 0;
    case "ArrowUp":
      return amount;
    case "ArrowDown":
      return -amount;
    default:
      return 0;
  }
};

const SaturationArea = ({ hsva, onChange }: { hsva: Hsva; onChange: ChangeHandler }) => {
  const drag = pointerDrag((event, commit) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(
      {
        ...hsva,
        s: clamp01((event.clientX - rect.left) / rect.width),
        v: 1 - clamp01((event.clientY - rect.top) / rect.height),
      },
      commit
    );
  });

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(hsva.s * 100)}%, brightness ${Math.round(hsva.v * 100)}%`}
      {...drag}
      onKeyDown={(event) => {
        const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
        const delta = keyDelta(event) / 100;
        if (!delta) return;
        event.preventDefault();
        onChange(
          horizontal
            ? { ...hsva, s: clamp01(hsva.s + delta) }
            : { ...hsva, v: clamp01(hsva.v + delta) },
          true
        );
      }}
      className="relative h-40 w-full cursor-crosshair touch-none rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsva.h} 100% 50%)`,
      }}
    >
      <div
        className={THUMB}
        style={{ left: `${hsva.s * 100}%`, top: `${(1 - hsva.v) * 100}%`, background: opaque(hsva) }}
      />
    </div>
  );
};

// A horizontal colour slider. The hit area is taller than the track, so it is easy to grab.
const ColorSlider = ({
  label,
  value,
  max,
  valueText,
  onChange,
  track,
  thumbColor,
  checkerboard = false,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  onChange: (value: number, commit: boolean) => void;
  track: string;
  thumbColor: string;
  checkerboard?: boolean;
}) => {
  // The thumb's centre stays inside the track, half a thumb (8px) from either end.
  const drag = pointerDrag((event, commit) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onChange(clamp01((event.clientX - rect.left - 8) / (rect.width - 16)) * max, commit);
  });

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={valueText}
      {...drag}
      onKeyDown={(event) => {
        const delta = keyDelta(event);
        if (!delta) return;
        event.preventDefault();
        onChange(Math.min(max, Math.max(0, value + (delta * max) / 100)), true);
      }}
      className="group/slider relative h-5 w-full cursor-pointer touch-none rounded-full outline-none"
    >
      <div
        className={cn(
          "absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] group-focus-visible/slider:ring-[3px] group-focus-visible/slider:ring-ring/50",
          checkerboard && "bg-checkerboard"
        )}
      >
        <div className="absolute inset-0" style={{ background: track }} />
      </div>
      <div
        className={cn(THUMB, "top-1/2")}
        style={{ left: `calc(8px + ${value / max} * (100% - 16px))`, background: thumbColor }}
      />
    </div>
  );
};

// --- Fields ---

// Hex without the "#", which may be typed or pasted either way, like any other format.
// Copying the whole field puts the "#" back, so it pastes straight into CSS.
const HexInput = ({ hsva, onChange }: { hsva: Hsva; onChange: ChangeHandler }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  const hex = opaque(hsva).slice(1).toUpperCase();

  const apply = (text: string) => {
    const parsed = parseColor(text);
    if (!parsed) return false;
    // A plain six digit hex leaves the opacity as it is, like typing over the field would.
    const keepAlpha = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text.trim());
    onChange(rgbaToHsva({ ...parsed, a: keepAlpha ? hsva.a : parsed.a }, hsva), true);
    return true;
  };

  const commit = () => {
    if (draft === null) return;
    apply(draft);
    setDraft(null);
  };

  return (
    <div className="flex h-7 min-w-0 items-center rounded-md border border-input bg-input/30 text-xs shadow-xs transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 hover:border-ring/60">
      <span className="pl-2 text-muted-foreground select-none">#</span>
      <input
        aria-label="Hex"
        spellCheck={false}
        autoComplete="off"
        value={draft ?? hex}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          commit();
          event.currentTarget.select();
        }}
        onPaste={(event) => {
          if (!apply(event.clipboardData.getData("text"))) return;
          event.preventDefault();
          setDraft(null);
        }}
        onCopy={(event) => {
          const input = event.currentTarget;
          if (draft !== null || input.selectionStart !== 0 || input.selectionEnd !== input.value.length)
            return;
          event.preventDefault();
          event.clipboardData.setData("text/plain", hsvaToHex(hsva).toUpperCase());
        }}
        className="h-full min-w-0 flex-1 bg-transparent pr-2 pl-1 font-mono tracking-wide uppercase outline-none selection:bg-primary selection:text-primary-foreground"
      />
    </div>
  );
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="mt-1 block text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
    {children}
  </span>
);

const IconButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5"
  >
    {children}
  </button>
);

interface EyeDropperApi {
  open: () => Promise<{ sRGBHex: string }>;
}
// Chromium only; the button is left out elsewhere.
const EyeDropper =
  typeof window === "undefined"
    ? undefined
    : (window as unknown as { EyeDropper?: new () => EyeDropperApi }).EyeDropper;

// --- Picker ---

/**
 * The colour picker panel. `onChange` gets hex (`#rrggbb`, or `#rrggbbaa` below full opacity):
 * live while dragging, at most once per frame, and right away when a drag is released or a
 * value is typed, pasted or picked.
 */
function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  // `prop` is the value last seen, `emitted` the last one sent: when the parent hands back what
  // was sent, the picker keeps its own state (hue and saturation survive grey and black).
  const [state, setState] = React.useState(() => ({
    hsva: toHsva(value),
    prop: value,
    emitted: null as string | null,
  }));
  if (value !== state.prop) {
    const own = value === state.emitted || normalizeColor(value) === hsvaToHex(state.hsva);
    setState({ ...state, prop: value, hsva: own ? state.hsva : toHsva(value, state.hsva) });
  }
  const { hsva } = state;

  const [format, setFormat] = React.useState(loadFormat);
  const [copied, setCopied] = React.useState(false);
  const recent = useRecentColors();

  // Live changes go out once per animation frame; a commit sends the latest one right away.
  const onChangeRef = React.useRef(onChange);
  const pending = React.useRef<{ hex: string; frame: number } | null>(null);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  });
  const flush = React.useCallback(() => {
    const current = pending.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    pending.current = null;
    setState((previous) => ({ ...previous, emitted: current.hex }));
    onChangeRef.current(current.hex);
  }, []);
  React.useEffect(() => flush, [flush]);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  const change: ChangeHandler = (next, commit = false) => {
    setState((previous) => ({ ...previous, hsva: next }));
    const hex = hsvaToHex(next);
    if (pending.current) pending.current.hex = hex;
    else pending.current = { hex, frame: requestAnimationFrame(flush) };
    if (commit) flush();
  };

  const applyText = (text: string) => {
    const parsed = parseColor(text);
    if (parsed) change(rgbaToHsva(parsed, hsva), true);
    return parsed !== null;
  };

  const hex = hsvaToHex(hsva);
  const rgb = opaque(hsva);
  const channels = channelsFor(format, hsva);

  return (
    <div
      className="flex flex-col gap-3"
      // Pasting anywhere outside the text fields sets the colour; copying copies it as hex.
      onPaste={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (applyText(event.clipboardData.getData("text"))) event.preventDefault();
      }}
      onCopy={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        event.clipboardData.setData("text/plain", hex.toUpperCase());
      }}
    >
      <SaturationArea hsva={hsva} onChange={change} />

      <div className="flex items-center gap-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ColorSlider
            label="Hue"
            value={hsva.h}
            max={360}
            valueText={`${Math.round(hsva.h)}°`}
            onChange={(h, commit) => change({ ...hsva, h }, commit)}
            track="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)"
            thumbColor={hsvaToHex({ h: hsva.h, s: 1, v: 1, a: 1 })}
          />
          <ColorSlider
            label="Opacity"
            value={hsva.a * 100}
            max={100}
            valueText={`${Math.round(hsva.a * 100)}%`}
            onChange={(a, commit) => change({ ...hsva, a: a / 100 }, commit)}
            track={`linear-gradient(to right, ${rgb}00, ${rgb})`}
            thumbColor={hex}
            checkerboard
          />
        </div>
        <div className="bg-checkerboard size-9 shrink-0 overflow-hidden rounded-md shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)]">
          <div className="size-full" style={{ background: hex }} />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Select
            value={format}
            onValueChange={(next) => {
              setFormat(next as ColorFormat);
              try {
                localStorage.setItem(FORMAT_KEY, next);
              } catch {
                // Not remembered without storage.
              }
            }}
          >
            <SelectTrigger aria-label="Color format" className="h-7 w-[5.5rem] px-2 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center">
            {EyeDropper && (
              <IconButton
                label="Pick a color from the screen"
                onClick={() => {
                  new EyeDropper()
                    .open()
                    .then(({ sRGBHex }) => {
                      const parsed = parseColor(sRGBHex);
                      if (parsed) change(rgbaToHsva({ ...parsed, a: hsva.a }, hsva), true);
                    })
                    // Cancelled with Escape.
                    .catch(() => {});
                }}
              >
                <Pipette />
              </IconButton>
            )}
            <IconButton
              label={copied ? "Copied" : "Copy hex"}
              onClick={() => {
                navigator.clipboard
                  .writeText(hex.toUpperCase())
                  .then(() => setCopied(true))
                  .catch(() => {});
              }}
            >
              {copied ? <Check className="text-primary" /> : <Copy />}
            </IconButton>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {format === "hex" ? (
            <div className="col-span-3">
              <HexInput hsva={hsva} onChange={change} />
              <FieldLabel>Hex</FieldLabel>
            </div>
          ) : (
            channels.map((channel) => (
              <div key={`${format}-${channel.label}`} className="min-w-0">
                <NumberField
                  size="sm"
                  stepper={false}
                  aria-label={channel.label}
                  value={channel.value}
                  min={channel.min}
                  max={channel.max}
                  step={channel.step}
                  precision={channel.precision}
                  onChange={(next) => change(channel.apply(next))}
                  onCommit={flush}
                />
                <FieldLabel>{channel.label}</FieldLabel>
              </div>
            ))
          )}
          <div className="min-w-0">
            <NumberField
              size="sm"
              stepper={false}
              aria-label="Opacity"
              unit="%"
              value={Math.round(hsva.a * 100)}
              min={0}
              max={100}
              onChange={(a) => change({ ...hsva, a: a / 100 })}
              onCommit={flush}
            />
            <FieldLabel>Alpha</FieldLabel>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 border-t pt-2.5">
        <p className="text-xs font-medium text-muted-foreground">Recent colors</p>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground/80">Colors you pick show up here.</p>
        ) : (
          <div className="grid grid-cols-8 gap-1.5">
            {recent.map((color) => (
              <button
                key={color}
                type="button"
                title={color.toUpperCase()}
                aria-label={`Use ${color.toUpperCase()}`}
                onClick={() => applyText(color)}
                className={cn(
                  "bg-checkerboard aspect-square cursor-pointer overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] transition-transform outline-none hover:scale-110 focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  color === hex && "ring-2 ring-primary ring-offset-1 ring-offset-popover"
                )}
              >
                <span className="block size-full" style={{ background: color }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Field ---

/**
 * A colour swatch that opens the picker. Interacting elsewhere in the page, or switching tabs
 * and windows, leaves it open: only a click outside or Escape closes it. The colour is added
 * to the recent colours when it closes, if it changed.
 */
function ColorField({
  id,
  value,
  onChange,
  defaultColor = "#ffffff",
  onOpenChange,
  onClear,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  /** Any CSS colour; empty for none. */
  value: string;
  onChange: (hex: string) => void;
  /** Where the picker starts when `value` is empty. */
  defaultColor?: string;
  onOpenChange?: (open: boolean) => void;
  /** Shows a button that removes the colour. */
  onClear?: () => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [valueAtOpen, setValueAtOpen] = React.useState(value);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setValueAtOpen(value);
    } else if (value !== valueAtOpen) {
      const hex = normalizeColor(value);
      if (hex) addRecentColor(hex);
    }
    onOpenChange?.(next);
  };

  const rgba = value ? parseColor(value) : null;
  const alpha = rgba ? Math.round(rgba.a * 100) : null;
  const clearable = Boolean(onClear && value);

  return (
    <div className={cn("relative min-w-0", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={ariaLabel}
            className={cn(
              "flex h-10 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-input bg-input/30 pr-3 pl-1.5 text-sm shadow-xs transition-[border-color,box-shadow] outline-none hover:border-ring/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:border-ring",
              clearable && "pr-9"
            )}
          >
            <span className="bg-checkerboard size-7 shrink-0 overflow-hidden rounded-[5px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]">
              <span className="block size-full" style={{ background: rgba ? value : undefined }} />
            </span>
            {rgba ? (
              <span className="truncate font-mono text-xs tracking-wide">
                {rgbaToHex({ ...rgba, a: 1 }).slice(1).toUpperCase()}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">None</span>
            )}
            {alpha !== null && alpha < 100 && (
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                {alpha}%
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={8}
          collisionPadding={8}
          className="w-64 p-3"
          // Focus leaving the page (switching tabs or windows to copy a colour) or landing
          // elsewhere doesn't close the picker; clicking outside or Escape does.
          onFocusOutside={(event) => event.preventDefault()}
        >
          <ColorPicker value={value || defaultColor} onChange={onChange} />
        </PopoverContent>
      </Popover>
      {clearable && (
        <button
          type="button"
          title="Remove color"
          aria-label="Remove color"
          onClick={onClear}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export { ColorField, ColorPicker };
