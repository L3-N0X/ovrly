import type React from "react";
import { DEFAULT_SHADOW, type BaseElementStyle } from "@/lib/types";

const toNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * The drop shadow of an element, like Figma's: nothing until `shadowColor` is set. An element
 * with a fill (`box`) casts it from its box, which is the only kind of shadow that can spread;
 * anything else casts it from what it draws (text, an icon, a stroke, its children), so a title
 * gets a shadow behind its letters rather than a rectangle.
 */
export const shadowStyle = (
  style: BaseElementStyle | null | undefined,
  { box = false }: { box?: boolean } = {}
): React.CSSProperties => {
  if (!style?.shadowColor) return {};
  const x = toNumber(style.shadowX, DEFAULT_SHADOW.shadowX);
  const y = toNumber(style.shadowY, DEFAULT_SHADOW.shadowY);
  const blur = Math.max(0, toNumber(style.shadowBlur, DEFAULT_SHADOW.shadowBlur));
  if (box) {
    const spread = toNumber(style.shadowSpread, DEFAULT_SHADOW.shadowSpread);
    return { boxShadow: `${x}px ${y}px ${blur}px ${spread}px ${style.shadowColor}` };
  }
  return { filter: `drop-shadow(${x}px ${y}px ${blur / 2}px ${style.shadowColor})` };
};
