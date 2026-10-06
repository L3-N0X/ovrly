import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrismaElement } from "@/lib/types";
import {
  bingoMiddleIndex,
  FREE_SPACE_LABEL,
  normalizeBingoData,
  type BingoDataUpdate,
} from "@/lib/bingo";
import { shuffleBingoCard } from "@/lib/bingoApi";
import { cn } from "@/lib/utils";
import { Eraser, Loader2, Shuffle, X } from "lucide-react";

const FIELD_EDIT_DEBOUNCE_MS = 400;

interface BingoControlProps {
  element: PrismaElement;
  onDataChange: (elementId: string, data: BingoDataUpdate) => void;
}

const BingoControl: React.FC<BingoControlProps> = ({ element, onDataChange }) => {
  const data = normalizeBingoData(element.bingo);
  const serverFieldsKey = data.fields.join("\n");

  const [fields, setFields] = useState(data.fields);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cells typed into that haven't been sent yet. Only these are sent, so labels someone else
  // changes meanwhile are kept.
  const pendingEdits = useRef<Record<number, string>>({});

  // Adopt server state whenever it changes, except for the cells the user is still typing in.
  useEffect(() => {
    setFields(
      normalizeBingoData(element.bingo).fields.map(
        (field, index) => pendingEdits.current[index] ?? field
      )
    );
  }, [serverFieldsKey, element.bingo]);

  useEffect(() => {
    return () => {
      if (editTimer.current !== null) {
        clearTimeout(editTimer.current);
      }
    };
  }, []);

  if (!element.bingo) return null;

  const middleIndex = bingoMiddleIndex(data.rows, data.columns);
  const isFreeSpace = (index: number) => data.freeMiddle && index === middleIndex;
  const markedCount = data.checked.filter((checked, index) => checked && !isFreeSpace(index)).length;

  const handleFieldChange = (index: number, value: string) => {
    if (isFreeSpace(index)) return;

    const next = [...fields];
    next[index] = value;
    setFields(next);

    pendingEdits.current = { ...pendingEdits.current, [index]: value };
    setError(null);

    if (editTimer.current !== null) {
      clearTimeout(editTimer.current);
    }
    editTimer.current = setTimeout(() => {
      const edits = pendingEdits.current;
      pendingEdits.current = {};
      onDataChange(element.id, { fields: edits });
    }, FIELD_EDIT_DEBOUNCE_MS);
  };

  // The state the cell should end up in, for this cell only, like a click on the canvas.
  const handleToggle = (index: number) => {
    if (isFreeSpace(index)) return;
    onDataChange(element.id, { checked: { [index]: !data.checked[index] } });
  };

  // Only the marked cells are unmarked, so a mark someone sets at the same moment survives.
  const handleClearMarks = () => {
    const marked: Record<number, boolean> = {};
    data.checked.forEach((checked, index) => {
      if (checked) marked[index] = false;
    });
    onDataChange(element.id, { checked: marked });
  };

  const handleShuffle = async () => {
    setIsShuffling(true);
    setError(null);

    try {
      await shuffleBingoCard(element.id);
    } catch (shuffleError) {
      setError(
        shuffleError instanceof Error ? shuffleError.message : "Could not shuffle the card"
      );
    } finally {
      setIsShuffling(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`bingo-fields-${element.id}`}>
          Fields
          <span className="font-normal text-muted-foreground">
            {markedCount} of {data.fields.length - (data.freeMiddle ? 1 : 0)} marked
          </span>
        </Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearMarks}
            disabled={markedCount === 0}
          >
            <Eraser className="mr-2 h-4 w-4" />
            Clear Marks
          </Button>
          <Button variant="outline" size="sm" onClick={handleShuffle} disabled={isShuffling}>
            {isShuffling ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="mr-2 h-4 w-4" />
            )}
            {isShuffling ? "Shuffling..." : "Shuffle"}
          </Button>
        </div>
      </div>
      {/* Wide cards scroll sideways rather than squeezing every field into a sliver. */}
      <div className="overflow-x-auto pb-1">
        <div
          id={`bingo-fields-${element.id}`}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${data.columns}, minmax(6rem, 1fr))` }}
        >
          {fields.map((field, index) => {
            const isFree = isFreeSpace(index);
            const checked = isFree || data.checked[index];
            const name = isFree ? FREE_SPACE_LABEL : field.trim() || `Cell ${index + 1}`;

            return (
              <div key={index} className="relative">
                <Input
                  value={isFree ? FREE_SPACE_LABEL : field}
                  onChange={(event) => handleFieldChange(index, event.target.value)}
                  disabled={isFree}
                  aria-label={`Cell ${index + 1}`}
                  title={isFree ? undefined : field}
                  className={cn(
                    "h-9 pr-9 pl-2",
                    checked && "border-primary/70 bg-primary/15 dark:bg-primary/15"
                  )}
                />
                <button
                  type="button"
                  onClick={() => handleToggle(index)}
                  disabled={isFree}
                  aria-pressed={checked}
                  aria-label={`${checked ? "Unmark" : "Mark"} ${name}`}
                  title={isFree ? "The free middle is always marked" : checked ? "Unmark" : "Mark"}
                  className={cn(
                    "absolute inset-y-1 right-1 flex w-7 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none",
                    checked
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground/50 hover:bg-accent hover:text-foreground"
                  )}
                >
                  <X className="h-4 w-4" strokeWidth={checked ? 3 : 2} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

export default BingoControl;
