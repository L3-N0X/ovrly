import { type FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FREE_SPACE_LABEL, sanitizeBingoField } from "@/lib/bingo";

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

interface BingoCellProps {
  text: string;
  isChecked: boolean;
  isEditor: boolean;
  isFreeSpace: boolean;
  maxFontSize: number;
  crossColor: string;
  crossWidth: number;
  onToggle: () => void;
  onTextChange: (newText: string) => void;
  style: React.CSSProperties;
}

const BingoCell: FC<BingoCellProps> = ({
  text,
  isChecked,
  isEditor,
  isFreeSpace,
  maxFontSize,
  crossColor,
  crossWidth,
  onToggle,
  onTextChange,
  style,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const toggleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFitBox = useRef("");
  const [isEditing, setIsEditing] = useState(false);
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
   * Shrinks the label until it fits inside the cell, never exceeding the
   * configured maximum font size. Re-running is skipped while the cell box and
   * the label are unchanged, so a resize observer does not thrash layout.
   */
  const fitText = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    const ceiling = Math.max(MIN_FONT_SIZE, Math.min(maxFontSize, ABSOLUTE_MAX_FONT_SIZE));

    // Nothing to fit, so leave the label at its configured size.
    if (displayText.trim().length === 0) {
      textEl.style.fontSize = `${ceiling}px`;
      return;
    }

    const fits = (size: number) => {
      textEl.style.fontSize = `${size}px`;
      return textEl.scrollWidth <= width && textEl.scrollHeight <= height;
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

    // Measure on a single line first. While the label may wrap, a long word is
    // already broken across lines, so `scrollWidth` would report every size as
    // fitting and the search would settle on the maximum.
    textEl.style.whiteSpace = "nowrap";
    let bestSize = largestFittingSize();

    if (!fits(MIN_FONT_SIZE)) {
      // Too long for one line at any readable size: let it wrap instead.
      textEl.style.whiteSpace = "";
      bestSize = largestFittingSize();
    }

    textEl.style.whiteSpace = "";
    textEl.style.fontSize = `${bestSize}px`;
  }, [maxFontSize, displayText]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    lastFitBox.current = "";
    fitText();

    const resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;

      const boxKey = `${Math.round(box.width)}x${Math.round(box.height)}`;
      if (boxKey === lastFitBox.current) return;

      lastFitBox.current = boxKey;
      fitText();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [fitText]);

  // Leaving edit mode restores the fitted font size and re-runs the fit.
  useEffect(() => {
    if (!isEditing) {
      lastFitBox.current = "";
      fitText();
    }
  }, [isEditing, fitText]);

  useEffect(() => {
    if (!isEditing) return;

    const textEl = textRef.current;
    if (!textEl) return;

    // Edit at the configured size instead of the shrunken display size.
    textEl.style.fontSize = `${maxFontSize}px`;
    textEl.focus();

    const range = document.createRange();
    range.selectNodeContents(textEl);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing, maxFontSize]);

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
        "relative flex items-center justify-center overflow-hidden p-1 text-center wrap-break-word select-none",
        isInteractive && !isEditing && "cursor-pointer",
        isEditing && "cursor-text"
      )}
      style={style}
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
      <span
        key={editSession}
        ref={textRef}
        // min-w-0 lets the flex item shrink below its min-content width so a
        // long label wraps instead of forcing the cell to overflow.
        className="min-w-0 max-w-full wrap-break-word select-text outline-none"
        style={{ lineHeight: 1.1 }}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onBlur={commitEditing}
        onKeyDown={handleLabelKeyDown}
      >
        {displayText}
      </span>
      {isChecked && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M 10,10 L 90,90 M 90,10 L 10,90"
            stroke={crossColor}
            strokeWidth={crossWidth}
            // Keeps the stroke a constant pixel width in non-square cells,
            // which preserveAspectRatio="none" would otherwise distort.
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
};

export default BingoCell;
