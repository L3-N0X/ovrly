import { type FC, useMemo } from "react";
import type { BingoStyle, PrismaElement } from "@/lib/types";
import {
  bingoCardHeight,
  bingoMiddleIndex,
  normalizeBingoData,
  resolveBingoStyle,
} from "@/lib/bingo";
import { useBingoDataChange } from "@/lib/bingoDataContext";
import BingoCell, { type BingoCrossOptions } from "./BingoCell";

interface BingoProps {
  element: PrismaElement;
  /** Only the editor may mutate a card; the public overlay is read only. */
  isEditor?: boolean;
}

/**
 * Where the `index`th line (1-based) between `count` equal tracks starts, along an axis whose
 * tracks are separated by `line` pixels: the tracks before it plus the lines before it.
 */
const lineOffset = (index: number, count: number, line: number) =>
  `calc((100% - ${(count - 1) * line}px) * ${index / count} + ${(index - 1) * line}px)`;

/** Table lines in the gaps between the cells. The card's own border is the outer line. */
const GridLines: FC<{ rows: number; columns: number; width: number; color: string }> = ({
  rows,
  columns,
  width,
  color,
}) => (
  <>
    {Array.from({ length: columns - 1 }, (_, i) => (
      <div
        key={`column-${i}`}
        className="pointer-events-none absolute inset-y-0"
        style={{ left: lineOffset(i + 1, columns, width), width, backgroundColor: color }}
      />
    ))}
    {Array.from({ length: rows - 1 }, (_, i) => (
      <div
        key={`row-${i}`}
        className="pointer-events-none absolute inset-x-0"
        style={{ top: lineOffset(i + 1, rows, width), height: width, backgroundColor: color }}
      />
    ))}
  </>
);

const imageSizes = { cover: "cover", contain: "contain", fill: "100% 100%" } as const;

const Bingo: FC<BingoProps> = ({ element, isEditor = false }) => {
  const { bingo, style } = element;
  const bingoStyle = useMemo(() => resolveBingoStyle(style as BingoStyle | null), [style]);
  const data = useMemo(() => normalizeBingoData(bingo), [bingo]);
  const onBingoDataChange = useBingoDataChange();
  // The editor only mounts the provider, so this is what distinguishes a
  // writable canvas from the public OBS render.
  const canEdit = isEditor && onBingoDataChange !== null;

  const cross = useMemo<BingoCrossOptions>(
    () => ({
      color: bingoStyle.checkedCrossColor,
      thickness: bingoStyle.crossThickness,
      opacity: bingoStyle.crossOpacity,
      variant: bingoStyle.crossStyle,
    }),
    [
      bingoStyle.checkedCrossColor,
      bingoStyle.crossThickness,
      bingoStyle.crossOpacity,
      bingoStyle.crossStyle,
    ]
  );

  const middleIndex = bingoMiddleIndex(data.rows, data.columns);

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

  const borderWidth = bingoStyle.borderWidth;
  const { gridLines, gridLineWidth, backgroundImage } = bingoStyle;

  return (
    <div
      className="relative shrink-0 overflow-hidden"
      style={{
        width: `${bingoStyle.width}px`,
        height: `${bingoCardHeight(bingoStyle, data.rows, data.columns)}px`,
        backgroundColor: bingoStyle.backgroundColor,
        borderRadius: `${bingoStyle.borderRadius}px`,
        border:
          borderWidth > 0 ? `${borderWidth}px solid ${bingoStyle.borderColor}` : undefined,
        fontFamily: bingoStyle.fontFamily,
        color: bingoStyle.color,
      }}
    >
      {backgroundImage && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url(${JSON.stringify(backgroundImage)})`,
            backgroundSize: imageSizes[bingoStyle.backgroundImageFit] ?? "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            opacity: bingoStyle.backgroundImageOpacity / 100,
          }}
        />
      )}
      <div
        className="relative grid h-full w-full"
        style={{
          // minmax(0, 1fr) lets cells shrink below their content so the
          // autofitted labels stay inside the card instead of overflowing it.
          gridTemplateColumns: `repeat(${data.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${data.rows}, minmax(0, 1fr))`,
          // With grid lines the cells sit right on the lines, which run up to the border.
          gap: `${gridLines ? gridLineWidth : bingoStyle.gap}px`,
          padding: gridLines ? 0 : `${bingoStyle.padding}px`,
        }}
      >
        {gridLines && (
          <GridLines
            rows={data.rows}
            columns={data.columns}
            width={gridLineWidth}
            color={bingoStyle.gridLineColor}
          />
        )}
        {data.fields.map((field, index) => (
          <BingoCell
            key={index}
            text={field}
            isChecked={isCellChecked(index)}
            isEditor={canEdit}
            isFreeSpace={data.freeMiddle && index === middleIndex}
            maxFontSize={bingoStyle.fontSize}
            fontFamily={bingoStyle.fontFamily}
            cross={cross}
            index={index}
            onToggle={() => handleToggle(index)}
            onTextChange={(newText) => handleFieldChange(index, newText)}
          />
        ))}
      </div>
    </div>
  );
};

export default Bingo;
