import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type PrismaElement, type TimerStyle } from "@/lib/types";
import { Info } from "lucide-react";
import React from "react";
import { DEFAULT_DURATION_FORMAT } from "@/lib/duration";
import { cn } from "@/lib/utils";
import { Field, SMALL_CONTROL } from "./fields";
import { TextBoxStyleEditor } from "./TextBoxEditor";

// Timers and countdowns look alike: both show a duration in their format.
export const TimerStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: TimerStyle) => void;
}> = ({ element, onChange }) => (
  <TextBoxStyleEditor<TimerStyle>
    element={element}
    onChange={onChange}
    idPrefix="timer"
    previewWord="12:34:56"
    textFields={(style, update) => (
      <Field
        htmlFor={`${element.id}-timer-format`}
        label={
          <>
            Format
            <Popover>
              <PopoverTrigger>
                <Info className="size-3 cursor-pointer" />
              </PopoverTrigger>
              <PopoverContent>
                <div className="space-y-2 p-4 text-sm">
                  <p className="font-semibold">Format hint for entering timer display:</p>
                  <p>
                    Use special placeholders for your timer: <strong>D</strong> for days,{" "}
                    <strong>H</strong> for hours, <strong>m</strong> for minutes,{" "}
                    <strong>s</strong> for seconds. The largest one also counts everything above
                    it, so <strong>HH:mm:ss</strong> shows 50:00:00 for two days and two hours.
                  </p>
                  <p>
                    Example: <strong>H:mm:ss</strong> → 1:05:09
                  </p>
                  <p>Mix and match as needed for your display:</p>
                  <ul className="list-disc list-inside pl-4">
                    <li>
                      <strong>mm:ss</strong> → 07:45 (minutes:seconds)
                    </li>
                    <li>
                      <strong>H:mm</strong> → 3:22 (hours:minutes)
                    </li>
                    <li>
                      <strong>D[d] HH:mm</strong> → 3d 04:20 (days, then hours:minutes)
                    </li>
                    <li>
                      <strong>H[h] mm[min] ss[s]</strong> → 2h 01min 15s (text inside brackets will be
                      shown as written)
                    </li>
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </>
        }
      >
        <Input
          id={`${element.id}-timer-format`}
          value={style.format || DEFAULT_DURATION_FORMAT}
          onChange={(e) => update({ format: e.target.value })}
          className={cn("w-full font-mono", SMALL_CONTROL)}
        />
      </Field>
    )}
  />
);
