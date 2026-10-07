import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

// Pixels the pointer moves per step while scrubbing. Shift is ten times faster, Alt ten times
// slower.
const PX_PER_STEP = 2;
// Movement before a press turns into scrubbing; anything less is a click into the field.
const DRAG_THRESHOLD = 3;
// Holding a stepper button repeats after this long, then every REPEAT_MS.
const REPEAT_DELAY_MS = 400;
const REPEAT_MS = 50;

const speedFor = (event: { shiftKey: boolean; altKey: boolean }) =>
  event.shiftKey ? 10 : event.altKey ? 0.1 : 1;

const decimalsOf = (step: number) => (String(step).split(".")[1] ?? "").length;

/**
 * Evaluates what was typed: a number, or simple arithmetic like "16*2" or "(100-20)/2". A
 * trailing unit ("24px") is ignored. Null when it isn't either.
 */
const evaluate = (input: string): number | null => {
  const source = input
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .replace(/[a-z%°]+$/i, "");
  const tokens = source.match(/\d+\.?\d*|\.\d+|[-+*/()]/g);
  if (!tokens || tokens.join("") !== source) return null;

  let i = 0;
  const factor = (): number => {
    const token = tokens[i++];
    if (token === "-") return -factor();
    if (token === "+") return factor();
    if (token === "(") {
      const value = expression();
      return tokens[i++] === ")" ? value : NaN;
    }
    return token === undefined ? NaN : Number(token);
  };
  const term = (): number => {
    let value = factor();
    while (tokens[i] === "*" || tokens[i] === "/") {
      const operator = tokens[i++];
      const right = factor();
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  };
  const expression = (): number => {
    let value = term();
    while (tokens[i] === "+" || tokens[i] === "-") {
      const operator = tokens[i++];
      const right = term();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };

  const result = expression();
  return i === tokens.length && Number.isFinite(result) ? result : null;
};

interface NumberFieldProps {
  id?: string;
  value: number;
  /** Every change, including each step while scrubbing or holding a stepper button. */
  onChange: (value: number) => void;
  /** Once an interaction ends: scrubbing or a stepper press is released, or typing is confirmed. */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimals kept and shown. Defaults to those of `step`. */
  precision?: number;
  /** Shown after the value, e.g. "px" or "%". */
  unit?: string;
  /** Shown before the value, e.g. "X" or an icon. */
  prefix?: React.ReactNode;
  /** The up/down buttons on the right. */
  stepper?: boolean;
  /** Fills the background up to the value; needs `min` and `max`. */
  progress?: boolean;
  size?: "default" | "sm";
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  "aria-label"?: string;
}

/**
 * A number input that can be dragged sideways to change its value, like in Figma, except that
 * the whole field is the handle rather than only its label. A click without dragging types into
 * it instead; typed values accept arithmetic and are applied on Enter or blur. Arrow keys and
 * the stepper buttons count up and down (holding a button repeats), Shift by ten.
 */
function NumberField({
  id,
  value: rawValue,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
  precision = decimalsOf(step),
  unit,
  prefix,
  stepper = true,
  progress = false,
  size = "default",
  disabled = false,
  autoFocus,
  className,
  "aria-label": ariaLabel,
}: NumberFieldProps) {
  const value = Number.isFinite(rawValue) ? rawValue : (min ?? 0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Text being typed; null shows the value.
  const [draft, setDraft] = React.useState<string | null>(null);
  // The value while scrubbing or holding a stepper button, shown instead of the prop so the
  // field doesn't wait for (or flicker with) the round trip through the parent.
  const [live, setLive] = React.useState<number | null>(null);
  const [scrubbing, setScrubbing] = React.useState(false);

  const drag = React.useRef<{
    pointerId: number;
    startX: number;
    lastX: number;
    startValue: number;
    steps: number;
    value: number;
    active: boolean;
  } | null>(null);
  const hold = React.useRef<{ timer: ReturnType<typeof setTimeout>; value: number } | null>(null);

  const normalize = (next: number) => {
    const factor = 10 ** precision;
    let result = Math.round(next * factor) / factor;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };
  const format = (number: number) => String(Number(number.toFixed(precision)));

  // Leaves no stuck cursor or repeating timer behind if the field unmounts mid-interaction.
  React.useEffect(
    () => () => {
      document.documentElement.style.removeProperty("cursor");
      if (hold.current) clearTimeout(hold.current.timer);
    },
    []
  );

  const emit = (next: number) => {
    setLive(next);
    onChange(next);
  };

  const commitDraft = () => {
    if (draft === null) return value;
    setDraft(null);
    const parsed = evaluate(draft);
    if (parsed === null) return value;
    const next = normalize(parsed);
    if (next !== value) {
      onChange(next);
      onCommit?.(next);
    }
    return next;
  };

  // --- Scrubbing ---

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-stepper]")) return;
    // Already typing: clicks place the caret and select text as usual.
    if (target === inputRef.current && document.activeElement === inputRef.current) return;
    event.preventDefault();
    if (document.activeElement === inputRef.current) inputRef.current?.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      startValue: value,
      steps: 0,
      value,
      active: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active) {
      if (Math.abs(event.clientX - current.startX) < DRAG_THRESHOLD) return;
      current.active = true;
      setScrubbing(true);
      document.documentElement.style.cursor = "ew-resize";
    }
    current.steps += ((event.clientX - current.lastX) / PX_PER_STEP) * speedFor(event);
    current.lastX = event.clientX;

    const unclamped = current.startValue + Math.round(current.steps) * step;
    const next = normalize(unclamped);
    // Past min or max, moving back changes the value again right away.
    if ((min !== undefined && unclamped < min) || (max !== undefined && unclamped > max)) {
      current.steps = (next - current.startValue) / step;
    }
    if (next === current.value) return;
    current.value = next;
    emit(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current.active) {
      document.documentElement.style.removeProperty("cursor");
      setScrubbing(false);
      setLive(null);
      if (current.value !== current.startValue) onCommit?.(current.value);
    } else if (!cancelled) {
      inputRef.current?.focus();
    }
  };

  // --- Stepper buttons and arrow keys ---

  const stepBy = (from: number, direction: 1 | -1, event: { shiftKey: boolean; altKey: boolean }) =>
    normalize(from + direction * step * speedFor(event));

  const startHold = (direction: 1 | -1, event: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const modifiers = { shiftKey: event.shiftKey, altKey: event.altKey };
    const first = stepBy(commitDraft(), direction, modifiers);
    emit(first);
    const repeat = () => {
      if (!hold.current) return;
      hold.current.value = stepBy(hold.current.value, direction, modifiers);
      emit(hold.current.value);
      hold.current.timer = setTimeout(repeat, REPEAT_MS);
    };
    hold.current = { value: first, timer: setTimeout(repeat, REPEAT_DELAY_MS) };
  };

  const endHold = () => {
    const current = hold.current;
    if (!current) return;
    clearTimeout(current.timer);
    hold.current = null;
    setLive(null);
    onCommit?.(current.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const base = draft === null ? value : (evaluate(draft) ?? value);
      const next = stepBy(base, event.key === "ArrowUp" ? 1 : -1, event);
      setDraft(null);
      onChange(next);
      onCommit?.(next);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      event.currentTarget.select();
    } else if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  const shown = live ?? value;
  const fill =
    progress && min !== undefined && max !== undefined && max > min
      ? ((shown - min) / (max - min)) * 100
      : null;
  const small = size === "sm";

  return (
    <div
      data-slot="number-field"
      data-scrubbing={scrubbing || undefined}
      data-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => endDrag(event, false)}
      onPointerCancel={(event) => endDrag(event, true)}
      className={cn(
        "group/number relative flex w-full min-w-0 cursor-ew-resize touch-pan-y items-stretch overflow-hidden rounded-md border border-input bg-input/30 shadow-xs transition-[border-color,box-shadow] select-none",
        "hover:border-ring/60 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "data-[scrubbing]:border-ring data-[scrubbing]:bg-input/50",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        small ? "h-7 text-xs" : "h-9 text-sm",
        className
      )}
    >
      {fill !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary/15"
          style={{ width: `${Math.min(100, Math.max(0, fill))}%` }}
        />
      )}
      {prefix !== undefined && (
        <span
          className={cn(
            "relative flex shrink-0 items-center text-muted-foreground [&_svg]:size-3.5",
            small ? "pl-1.5" : "pl-2.5"
          )}
        >
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        id={id}
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuenow={shown}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft ?? format(shown)}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => commitDraft()}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative min-w-0 flex-1 cursor-[inherit] bg-transparent tabular-nums outline-none select-text focus:cursor-text",
          "selection:bg-primary selection:text-primary-foreground",
          small ? "px-1.5" : "px-2.5",
          prefix !== undefined && (small ? "pl-1" : "pl-1.5")
        )}
      />
      {unit && (
        <span
          className={cn(
            "relative flex shrink-0 items-center text-muted-foreground",
            small ? "pr-1.5 text-[11px]" : "pr-2.5 text-xs"
          )}
        >
          {unit}
        </span>
      )}
      {stepper && (
        <div
          data-stepper
          className="relative flex w-7 shrink-0 cursor-default flex-col border-l border-input"
        >
          {([1, -1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={direction === 1 ? "Increase" : "Decrease"}
              onPointerDown={(event) => startHold(direction, event)}
              onPointerUp={endHold}
              onPointerCancel={endHold}
              onLostPointerCapture={endHold}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground active:bg-primary/20",
                direction === 1 && "border-b border-input"
              )}
            >
              {direction === 1 ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { NumberField };
