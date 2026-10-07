import type React from "react";
import type { BaseElementStyle } from "@/lib/types";
import { fontFamilyOf, fontWeightOf } from "@/lib/fonts";

/**
 * The parts of an element's style every text element renders with. Shared so the title,
 * counter, timer and bingo renderers all fall back to the same font and weight.
 */
export const textStyle = (
  style: BaseElementStyle | null | undefined,
  defaultSize: number
): React.CSSProperties => ({
  fontFamily: fontFamilyOf(style),
  fontSize: typeof style?.fontSize === "number" ? `${style.fontSize}px` : `${defaultSize}px`,
  fontWeight: fontWeightOf(style),
  lineHeight: 1,
  color: style?.color || "#ffffff",
});