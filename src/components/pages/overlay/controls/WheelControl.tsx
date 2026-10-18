import React, { useEffect, useRef, useState } from "react";
import { Eraser, Loader2, Plus, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrismaElement } from "@/lib/types";
import {
  sanitizeWheelField,
  wheelSegments,
  WHEEL_MAX_FIELDS,
  WHEEL_MAX_FIELD_LENGTH,
  type WheelAction,
} from "@/lib/wheel";

interface WheelControlProps {
  element: PrismaElement;
  onFieldsChange: (elementId: string, fields: string[]) => void;
  onAction: (elementId: string, action: WheelAction) => void;
}

// Running a wheel of fortune: its entries (one segment each; empty ones are left off the wheel),
// spinning it, and what it landed on. Pasting several lines into an entry adds one per line.
const WheelControl: React.FC<WheelControlProps> = ({ element, onFieldsChange, onAction }) => {
  const wheel = element.wheel;
  const fields = wheel?.fields ?? [];
  const segmentCount = wheelSegments(fields).length;
  const listRef = useRef<HTMLOListElement>(null);
  // The entry to focus once it has been rendered (after adding or removing one).
  const focusIndex = useRef<number | null>(null);
  useEffect(() => {
    if (focusIndex.current === null) return;
    listRef.current?.querySelectorAll("input")[focusIndex.current]?.focus();
    focusIndex.current = null;
  });

  // Whether the last spin is still turning, by the server's clock: close enough for the buttons.
  const spinEnd = wheel?.spunAt ? Date.parse(wheel.spunAt) + wheel.duration : 0;
  const [now, setNow] = useState(() => Date.now());
  const spinning = spinEnd > now;
  useEffect(() => {
    if (spinEnd <= Date.now()) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), spinEnd - Date.now() + 50);
    return () => window.clearTimeout(timeout);
  }, [spinEnd]);
  // Pressed, but the spin hasn't come back from the server yet. Given up on after a while: the
  // server ignores a spin while the wheel still turns (someone else spun it a moment earlier).
  const [requested, setRequested] = useState<string | null>(null);
  const waiting = requested !== null && requested === (wheel?.spunAt ?? "");
  useEffect(() => {
    if (requested === null) return;
    const timeout = window.setTimeout(() => setRequested(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [requested]);

  if (!wheel) return null;

  const change = (next: string[]) => onFieldsChange(element.id, next.slice(0, WHEEL_MAX_FIELDS));
  const setField = (index: number, value: string) =>
    change(fields.map((field, i) => (i === index ? sanitizeWheelField(value) : field)));
  const insertAt = (index: number, values: string[]) => {
    change([...fields.slice(0, index), ...values, ...fields.slice(index)]);
    focusIndex.current = Math.min(index + values.length - 1, WHEEL_MAX_FIELDS - 1);
  };
  const removeAt = (index: number) => {
    change(fields.filter((_, i) => i !== index));
    focusIndex.current = fields.length > 1 ? Math.max(0, index - 1) : null;
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (fields.length < WHEEL_MAX_FIELDS) insertAt(index + 1, [""]);
    } else if (e.key === "Backspace" && fields[index] === "" && fields.length > 1) {
      e.preventDefault();
      removeAt(index);
    }
  };

  // A list pasted into an entry becomes one entry per line, starting with the one pasted into.
  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const lines = e.clipboardData
      .getData("text")
      .split(/\r?\n/)
      .map((line) => sanitizeWheelField(line).trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const rest = fields.filter((_, i) => i !== index || fields[index]!.trim() !== "");
    const at = fields[index]!.trim() === "" ? index : index + 1;
    change([...rest.slice(0, at), ...lines, ...rest.slice(at)]);
  };

  const spin = () => {
    setRequested(wheel.spunAt ?? "");
    onAction(element.id, { type: "spin" });
  };

  // Takes the entry it landed on off the wheel, for picking one after another without repeats.
  const removeResult = () => {
    const index = fields.findIndex((field) => field.trim() === wheel.result);
    if (index !== -1) change(fields.filter((_, i) => i !== index));
    onAction(element.id, { type: "clear" });
  };

  const result = !spinning && wheel.result;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          className="flex-1"
          onClick={spin}
          disabled={segmentCount === 0 || spinning || waiting}
          title={segmentCount === 0 ? "Add an entry first" : "Spin the wheel"}
        >
          {spinning || waiting ? <Loader2 className="animate-spin" /> : <RotateCw />}
          {spinning ? "Spinning…" : "Spin"}
        </Button>
      </div>

      {result && (
        <div className="flex items-center gap-2 rounded-md bg-secondary py-1.5 pr-1.5 pl-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">Landed on</div>
            <div className="truncate text-sm font-semibold" title={result}>
              {result}
            </div>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Take it off the wheel"
            aria-label="Remove the result from the wheel"
            onClick={removeResult}
          >
            <Trash2 />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Hide the result"
            aria-label="Hide the result"
            onClick={() => onAction(element.id, { type: "clear" })}
          >
            <Eraser />
          </Button>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`wheel-entries-${element.id}`}>
          Entries
          <span className="font-normal text-muted-foreground">{segmentCount} on the wheel</span>
        </Label>
        <ol id={`wheel-entries-${element.id}`} ref={listRef} className="space-y-1">
          {fields.map((field, index) => (
            <li key={index} className="flex items-center gap-1">
              <span className="w-5 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <Input
                value={field}
                maxLength={WHEEL_MAX_FIELD_LENGTH}
                aria-label={`Entry ${index + 1}`}
                placeholder="Empty entries are left off"
                onChange={(e) => setField(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={(e) => handlePaste(index, e)}
                className="h-8"
              />
              <Button
                size="icon-sm"
                variant="ghost"
                title="Remove entry"
                aria-label={`Remove entry ${index + 1}`}
                onClick={() => removeAt(index)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ol>
        <Button
          variant="outline"
          size="sm"
          onClick={() => insertAt(fields.length, [""])}
          disabled={fields.length >= WHEEL_MAX_FIELDS}
        >
          <Plus />
          Add entry
        </Button>
        <p className="text-xs text-muted-foreground">
          Enter adds the next entry. Paste a list to add one entry per line.
        </p>
      </div>
    </div>
  );
};

export default WheelControl;
