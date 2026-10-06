import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrismaElement } from "@/lib/types";
import { bingoMiddleIndex, FREE_SPACE_LABEL, normalizeBingoData } from "@/lib/bingo";
import { shuffleBingoCard } from "@/lib/bingoApi";
import { Loader2, Shuffle } from "lucide-react";

const FIELD_EDIT_DEBOUNCE_MS = 400;

interface BingoControlProps {
  element: PrismaElement;
  onDataChange: (elementId: string, data: { fields: string[] }) => void;
}

const BingoControl: React.FC<BingoControlProps> = ({ element, onDataChange }) => {
  const data = normalizeBingoData(element.bingo);
  const serverFieldsKey = data.fields.join("\n");

  const [fields, setFields] = useState(data.fields);
  const [isShuffling, setIsShuffling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingEdit = useRef(false);

  // Adopt server state whenever it changes, unless the user still has an
  // uncommitted edit in flight for this card.
  useEffect(() => {
    if (!hasPendingEdit.current) {
      setFields(normalizeBingoData(element.bingo).fields);
    }
  }, [serverFieldsKey, element.bingo]);

  useEffect(() => {
    return () => {
      if (editTimer.current !== null) {
        clearTimeout(editTimer.current);
      }
    };
  }, []);

  if (!element.bingo) return null;

  const middleIndex = bingoMiddleIndex(data.size);

  const handleFieldChange = (index: number, value: string) => {
    if (data.freeMiddle && index === middleIndex) return;

    const next = [...fields];
    next[index] = value;
    setFields(next);

    hasPendingEdit.current = true;
    setError(null);

    if (editTimer.current !== null) {
      clearTimeout(editTimer.current);
    }
    editTimer.current = setTimeout(() => {
      hasPendingEdit.current = false;
      onDataChange(element.id, { fields: next });
    }, FIELD_EDIT_DEBOUNCE_MS);
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
      <div className="flex justify-between items-center">
        <Label htmlFor={`bingo-fields-${element.id}`}>Fields</Label>
        <Button variant="outline" size="sm" onClick={handleShuffle} disabled={isShuffling}>
          {isShuffling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Shuffle className="mr-2 h-4 w-4" />
          )}
          {isShuffling ? "Shuffling..." : "Shuffle"}
        </Button>
      </div>
      <div>
        <div
          id={`bingo-fields-${element.id}`}
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${data.size}, minmax(0, 1fr))` }}
        >
          {fields.map((field, index) => {
            const isFreeSpace = data.freeMiddle && index === middleIndex;

            return (
              <Input
                key={index}
                value={isFreeSpace ? FREE_SPACE_LABEL : field}
                onChange={(event) => handleFieldChange(index, event.target.value)}
                disabled={isFreeSpace}
                aria-label={`Cell ${index + 1}`}
                className="h-9 px-2"
              />
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
