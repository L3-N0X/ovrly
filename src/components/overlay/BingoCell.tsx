import { type FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FREE_SPACE_LABEL, sanitizeBingoField, type BingoCrossStyle } from "@/lib/bingo";
import BingoCross from "./BingoCross";

/** Below this the label stops being readable, so we clamp instead of shrinking further. */
const MIN_FONT_SIZE = 6;
/** Upper bound for the autofit search, in case no maximum was configured. */
const ABSOLUTE_MAX_FONT_SIZE = 200;
/**
 * A click is only committed as a toggle once this has elapsed without a second
 * click arriving. This is what keeps "click to mark" and "double click to
 * rename" from firing both actions for a single interaction.
 */
const TOGGLE_INTENT_DELAY_MS = 220;

export interface BingoCrossOptions {
  color: string;
  thickness: number;
  opacity: number;
  variant: BingoCrossStyle;
}

interface BingoCellProps {
  text: string;
  isChecked: boolean;
  isEditor: boolean;
  isFreeSpace: boolean;
  maxFontSize: number;
  /** Changes the text metrics without resizing the cell, so it has to trigger a new fit. */
  fontFamily: string | undefined;
  fontWeight: number | undefined;
  cross: BingoCrossOptions;
  /** Position on the card, which varies the brush strokes of the cross. */
  index: number;
  onToggle: () => void;
  onTextChange: (newText: string) => void;
}

const BingoCell: FC<BingoCellProps> = ({
  text,
  isChecked,
  isEditor,
  isFreeSpace,
  maxFontSize,
  fontFamily,
  fontWeight,
  cross,
  index,
  onToggle,
  onTextChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const toggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFitBox = useRef("");
  const [isEditing, setIsEditing] = useState(false);
  // The cross is drawn in pixels, so it needs the size of the cell.
  const [cellSize, setCellSize] = useState({ width: 0, height: 0 });
  // Bumped to remount the label span, which is the only reliable way to restore
  // its text after an abandoned contentEditable edit.
  const [editSession, setEditSession] = useState(0);

  const isInteractive = isEditor && !isFreeSpace;
  const displayText = isFreeSpace ? FREE_SPACE_LABEL : text;

  const clearToggleTimer = useCallback(() => {
    if (toggleTimer.current !== null) {
      clearTimeout(toggleTimer.current);
      toggleTimer.current = null;
    }
  }, []);

  useEffect(() => clearToggleTimer, [clearToggleTimer]);

  /**
   * Picks the largest font size, up to the configured maximum, at which the label fits the
   * cell while wrapping only between words. Re-running is skipped while the cell box and the
   * label are unchanged, so a resize observer does not thrash layout.
   */
  const fitText = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    // Layout sizes, not getBoundingClientRect: the editor canvas is scaled with a transform,
    // and the label's scroll sizes below are unscaled too.
    const computed = getComputedStyle(container);
    const width =
      container.clientWidth - parseFloat(computed.paddingLeft) - parseFloat(computed.paddingRight);
    const height =
      container.clientHeight - parseFloat(computed.paddingTop) - parseFloat(computed.paddingBottom);
    if (width <= 0 || height <= 0) return;

    const ceiling = Math.max(MIN_FONT_SIZE, Math.min(maxFontSize, ABSOLUTE_MAX_FONT_SIZE));

    // Nothing to fit, so leave the label at its configured size.
    if ((textEl.textContent ?? "").trim().length === 0) {
      textEl.style.fontSize = `${ceiling}px`;
      return;
    }

    // Half a pixel of slack absorbs rounding in the scroll sizes.
    const fits = (size: number) => {
      textEl.style.fontSize = `${size}px`;
      return textEl.scrollWidth <= width + 0.5 && textEl.scrollHeight <= height + 0.5;
    };

    const largestFittingSize = () => {
      let low = MIN_FONT_SIZE;
      let high = ceiling;
      let bestSize = MIN_FONT_SIZE;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (fits(mid)) {
          bestSize = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      return bestSize;
    };

    // Words may only wrap between each other, so a word that is too long for the cell makes
    // the label wider than the cell and the size shrinks until the longest word fits.
    textEl.style.overflowWrap = "normal";
    const wholeWordsSize = largestFittingSize();
    const wholeWordsFit = fits(wholeWordsSize);
    let bestSize = wholeWordsSize;

    if (wholeWordsSize < ceiling) {
      // Breaking inside a word is only worth it when one long word would otherwise shrink the
      // whole label far below what the cell allows, or doesn't fit at all.
      textEl.style.overflowWrap = "anywhere";
      const brokenSize = largestFittingSize();
      if (!wholeWordsFit || brokenSize >= wholeWordsSize * 1.5) {
        bestSize = brokenSize;
      } else {
        textEl.style.overflowWrap = "normal";
      }
    }

    textEl.style.fontSize = `${bestSize}px`;
  }, [maxFontSize]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    lastFitBox.current = "";

    // Also called once right after `observe`, which takes care of the first fit.
    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const boxKey = `${width}x${height}`;
      if (boxKey === lastFitBox.current) return;

      lastFitBox.current = boxKey;
      setCellSize({ width, height });
      fitText();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [fitText]);

  // A new label or font doesn't resize the cell, so the observer above won't notice it.
  useLayoutEffect(() => {
    if (!isEditing) fitText();
  }, [displayText, fontFamily, fontWeight, isEditing, fitText]);

  // Web fonts arrive after the first fit, and their metrics differ from the fallback's.
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const refit = () => fitText();
    fonts.addEventListener("loadingdone", refit);
    return () => fonts.removeEventListener("loadingdone", refit);
  }, [fitText]);

  useEffect(() => {
    if (!isEditing) return;

    const textEl = textRef.current;
    if (!textEl) return;

    textEl.focus();

    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing]);

  const beginEditing = () => {
    setIsEditing(true);
  };

  const commitEditing = () => {
    if (!isEditing) return;
    setIsEditing(false);

    if (isFreeSpace) return;

    const nextText = sanitizeBingoField(textRef.current?.innerText ?? "");
    if (nextText !== text) {
      onTextChange(nextText);
    }
  };

  const cancelEditing = () => {
    if (!isEditing) return;
    setIsEditing(false);
    setEditSession((session) => session + 1);
  };

  const handleClick = () => {
    if (!isInteractive || isEditing) return;

    clearToggleTimer();
    toggleTimer.current = setTimeout(() => {
      toggleTimer.current = null;
      onToggle();
    }, TOGGLE_INTENT_DELAY_MS);
  };

  const handleDoubleClick = () => {
    if (!isInteractive) return;

    clearToggleTimer();
    beginEditing();
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isEditor || isEditing) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isFreeSpace) {
        onToggle();
      }
    } else if (event.key === "F2") {
      event.preventDefault();
      if (!isFreeSpace) {
        beginEditing();
      }
    }
  };

  const handleLabelKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === "Enter") {
      // contentEditable would otherwise insert a line break.
      event.preventDefault();
      commitEditing();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden text-center select-none",
        isInteractive && !isEditing && "cursor-pointer",
        isEditing && "cursor-text"
      )}
      // Scales with the cell, so small cells keep most of their room for the label.
      style={{ padding: "clamp(1px, 5%, 8px)" }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleCellKeyDown}
      {...(isEditor
        ? {
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": isFreeSpace ? undefined : isChecked,
            "aria-label": isFreeSpace
              ? "Free space"
              : text.trim().length > 0
                ? `${text.trim()} (${isChecked ? "marked" : "not marked"})`
                : "Empty cell",
            title: isFreeSpace
              ? "Free space"
              : "Click to mark, double-click or press F2 to rename",
          }
        : {})}
    >
      {isChecked && <BingoCross width={cellSize.width} height={cellSize.height} {...cross} seed={index} />}
      <span
        key={editSession}
        ref={textRef}
        // min-w-0 lets the flex item shrink below its min-content width, which is what makes
        // a word that is too long show up as overflow while fitting. `text-wrap: balance`
        // spreads a wrapped label evenly over its lines instead of leaving one word dangling.
        className="relative max-w-full min-w-0 select-text outline-none"
        style={{ lineHeight: 1.12, textWrap: "balance", fontWeight }}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={commitEditing}
        onInput={fitText}
        onKeyDown={handleLabelKeyDown}
      >
        {displayText}
      </span>
    </div>
  );
};

export default BingoCell;
