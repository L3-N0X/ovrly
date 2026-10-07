import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FontWeight } from "@/lib/fonts";
import { FONT_WEIGHTS } from "@/lib/fonts";

/** The CSS names of the weights a font can be asked for. */
const FONT_WEIGHT_LABELS: Record<FontWeight, string> = {
  100: "Thin",
  200: "Extra Light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi Bold",
  700: "Bold",
  800: "Extra Bold",
  900: "Black",
};

/**
 * Picks a font weight. A dropdown rather than a number field, because the weights are a fixed
 * set: a custom font has no weight axis to scrub along (see public/custom-fonts.json), and a
 * weight no font has would leave the browser to guess.
 */
export function FontWeightPicker({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: FontWeight;
  onChange: (fontWeight: FontWeight) => void;
  className?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(Number(next) as FontWeight)}>
      <SelectTrigger id={id} aria-label="Font weight" className={className}>
        <SelectValue>{FONT_WEIGHT_LABELS[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {FONT_WEIGHTS.map((weight) => (
          <SelectItem key={weight} value={String(weight)}>
            {FONT_WEIGHT_LABELS[weight]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}