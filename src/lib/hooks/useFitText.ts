import { useCallback, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

const MIN_FONT_SIZE = 10;

// Text wider than this many times the box gets tiny and unreadable, so leave the ellipsis
// (from the caller's truncate) to do the work instead.
const MIN_SCALE = 0.5;

/**
 * Shrinks the font size of an element until its text fits on a single line, leaving it at
 * the size it starts with when it already fits. Meant for readouts that keep growing, such
 * as a timer ticking past an hour, which would otherwise wrap onto a second line.
 *
 * The element must be a block that clips its overflow, and its text must not wrap.
 */
export const useFitText = <T extends HTMLElement>(ref: RefObject<T | null>, text: string) => {
  // Read once, before anything is resized: afterwards the computed size is our own shrunken
  // value and the original would be lost.
  const fontSizeRef = useRef<number | null>(null);

  const fit = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    const computed = getComputedStyle(element);
    if (fontSizeRef.current === null) {
      fontSizeRef.current = parseFloat(computed.fontSize) || MIN_FONT_SIZE;
    }
    const fontSize = fontSizeRef.current;
    const available =
      element.clientWidth -
      parseFloat(computed.paddingLeft) -
      parseFloat(computed.paddingRight);
    if (available <= 0) return;

    element.style.fontSize = `${fontSize}px`;
    const measured = element.scrollWidth;
    if (measured <= available) return;

    // Width scales about linearly with the font size, so one step lands close enough that
    // the loop below only has to correct rounding and the odd wide glyph.
    const scaled = Math.max(fontSize * MIN_SCALE, (fontSize * available) / measured);
    element.style.fontSize = `${scaled}px`;
    while (element.scrollWidth > available && parseFloat(element.style.fontSize) > MIN_FONT_SIZE) {
      const next = Math.max(MIN_FONT_SIZE, parseFloat(element.style.fontSize) - 1);
      if (next === parseFloat(element.style.fontSize)) break;
      element.style.fontSize = `${next}px`;
    }
  }, [ref]);

  // Layout runs before the browser paints, so the text never shows at the old size.
  useLayoutEffect(fit, [fit, text]);
};