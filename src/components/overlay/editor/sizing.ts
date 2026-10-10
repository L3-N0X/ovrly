import { CANVAS_ELEMENT_ATTRIBUTE } from "../canvasSelection";

// How one side of an element is sized: a number of pixels, its content, or its parent (Figma's
// "Fixed", "Hug contents" and "Fill container").
export type SizeMode = "fixed" | "hug" | "fill";

// The size an element is drawn at on the editor canvas right now, along one side.
const measuredSize = (elementId: string, side: "width" | "height") => {
  const box = document.querySelector(`[${CANVAS_ELEMENT_ATTRIBUTE}="${CSS.escape(elementId)}"]`)
    ?.firstElementChild as HTMLElement | null | undefined;
  return (side === "width" ? box?.offsetWidth : box?.offsetHeight) || undefined;
};

/**
 * The style patch that sizes one side of an element by `mode`. An element that becomes fixed
 * keeps the size it has on the canvas, like in Figma, or else its stored one or `fallback`.
 * `autoKey` is the style key for hugging, for elements that store it (containers); elements
 * that hug in some other way leave it out.
 */
export const sizeModePatch = (
  elementId: string,
  style: { width?: number; height?: number; fillWidth?: boolean; fillHeight?: boolean },
  side: "width" | "height",
  mode: SizeMode,
  fallback: number,
  autoKey?: string
): Record<string, unknown> => ({
  [side === "width" ? "fillWidth" : "fillHeight"]: mode === "fill",
  ...(autoKey && { [autoKey]: mode === "hug" }),
  ...(mode === "fixed" && {
    [side]: measuredSize(elementId, side) ?? style[side] ?? fallback,
  }),
});

// The mode of one side of an element that is either fixed or fills its parent.
export const fixedOrFill = (
  style: { fillWidth?: boolean; fillHeight?: boolean },
  side: "width" | "height"
): SizeMode =>
  (side === "width" ? style.fillWidth : style.fillHeight) === true ? "fill" : "fixed";

// The modes offered by elements that have a size of their own, and by those that hug content.
export const FIXED_OR_FILL = ["fixed", "fill"] as const;
export const HUG_OR_FILL = ["hug", "fill"] as const;
