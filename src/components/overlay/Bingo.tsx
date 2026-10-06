import { type FC, useMemo } from "react";
import type { BingoStyle, PrismaElement } from "@/lib/types";
import { bingoMiddleIndex, normalizeBingoData, resolveBingoStyle } from "@/lib/bingo";
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

  const isCellChecked = (index: number) =>
    (data.freeMiddle && index === middleIndex) || data.checked[index];

  if (!bingo) {
    return null;
  }

  // Sent as the state the cell should end up in, for this cell only: someone else marking
  // another cell (or this one) at the same time doesn't undo either change.
  const handleToggle = (index: number) => {
    if (!canEdit || !onBingoDataChange) return;
    onBingoDataChange(element.id, { checked: { [index]: !isCellChecked(index) } });
  };

  const handleFieldChange = (index: number, newText: string) => {
    if (!canEdit || !onBingoDataChange) return;
    onBingoDataChange(element.id, { fields: { [index]: newText } });
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
    </div>
  );
};

export default Bingo;
