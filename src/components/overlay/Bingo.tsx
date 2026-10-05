import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import type { BingoStyle, PrismaElement } from "@/lib/types";
import { bingoMiddleIndex, normalizeBingoData, resolveBingoStyle } from "@/lib/bingo";
import { toggleBingoCell } from "@/lib/bingoApi";
import { useBingoDataChange } from "@/lib/bingoDataContext";
import BingoCell from "./BingoCell";

interface BingoProps {
  element: PrismaElement;
  /** Only the editor may mutate a card; the public overlay is read only. */
  isEditor?: boolean;
}

const Bingo: FC<BingoProps> = ({ element, isEditor = false }) => {
  const { bingo, style } = element;
  const bingoStyle = useMemo(() => resolveBingoStyle(style as BingoStyle | null), [style]);
  const data = useMemo(() => normalizeBingoData(bingo), [bingo]);
  const onBingoDataChange = useBingoDataChange();
  // The editor only mounts the provider, so this is what distinguishes a
  // writable canvas from the public OBS render.
  const canEdit = isEditor && onBingoDataChange !== null;

  const middleIndex = bingoMiddleIndex(data.size);
  // Cells the user has just clicked but whose server state has not arrived yet.
  const [pendingToggles, setPendingToggles] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // The WebSocket broadcast carries the authoritative state, so once it lands
  // the optimistic overrides are no longer needed.
  useEffect(() => {
    setPendingToggles({});
    setError(null);
  }, [data]);

  const isCellChecked = useCallback(
    (index: number) => {
      const isFreeSpace = data.freeMiddle && index === middleIndex;
      if (isFreeSpace) return true;
      return pendingToggles[index] ?? data.checked[index];
    },
    [data, middleIndex, pendingToggles]
  );

  const handleToggle = useCallback(
    async (index: number) => {
      if (!canEdit) return;

      setError(null);
      setPendingToggles((pending) => ({ ...pending, [index]: !isCellChecked(index) }));

      try {
        await toggleBingoCell(element.id, index);
      } catch (toggleError) {
        setPendingToggles((pending) => {
          const next = { ...pending };
          delete next[index];
          return next;
        });
        setError(toggleError instanceof Error ? toggleError.message : "Could not update the cell");
      }
    },
    [element.id, isCellChecked, canEdit]
  );

  if (!bingo) {
    return null;
  }

  const handleFieldChange = (index: number, newText: string) => {
    if (!canEdit || !onBingoDataChange) return;

    const fields = [...data.fields];
    fields[index] = newText;
    onBingoDataChange(element.id, { fields });
  };

  const borderWidth = bingoStyle.borderWidth ?? 0;

  return (
    <div className="relative shrink-0">
      <div
        className="grid"
        style={{
          width: `${bingoStyle.width}px`,
          height: `${bingoStyle.height}px`,
          // minmax(0, 1fr) lets cells shrink below their content so the
          // autofitted labels stay inside the card instead of overflowing it.
          gridTemplateColumns: `repeat(${data.size}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${data.size}, minmax(0, 1fr))`,
          gap: `${bingoStyle.gap}px`,
          padding: `${bingoStyle.padding}px`,
          backgroundColor: bingoStyle.backgroundColor,
          borderRadius: `${bingoStyle.borderRadius}px`,
          border:
            borderWidth > 0
              ? `${borderWidth}px solid ${bingoStyle.borderColor ?? "transparent"}`
              : undefined,
          fontFamily: bingoStyle.fontFamily,
        }}
      >
        {data.fields.map((field, index) => {
          const checked = isCellChecked(index);

          const cellStyle: React.CSSProperties = {
            backgroundColor: checked ? bingoStyle.checkedBackgroundColor : "transparent",
            color: checked ? bingoStyle.checkedColor : bingoStyle.color,
            borderRadius: `${(bingoStyle.borderRadius ?? 0) / 2}px`,
          };

          return (
            <BingoCell
              key={index}
              text={field}
              isChecked={checked}
              isEditor={canEdit}
              isFreeSpace={data.freeMiddle && index === middleIndex}
              maxFontSize={bingoStyle.fontSize ?? 16}
              crossColor={bingoStyle.checkedCrossColor ?? "#ffffff"}
              crossWidth={bingoStyle.crossWidth ?? 4}
              onToggle={() => handleToggle(index)}
              onTextChange={(newText) => handleFieldChange(index, newText)}
              style={cellStyle}
            />
          );
        })}
      </div>
      {canEdit && error && (
        <p
          role="alert"
          className="absolute -bottom-6 left-0 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground"
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default Bingo;
