import { createContext, useContext } from "react";
import type React from "react";
import { fillOf, type ElementStyle, type ElementType } from "@/lib/types";

// How a parent places its children, which decides what filling it takes: a flex row or column
// (containers, scrollers, the canvas in AUTO mode, a cycle stack's layers) grows the child along
// its direction and stretches it across; a free parent (groups, the canvas in FREE mode) has
// FreeItem span it and the child take all of that. Null outside any parent (previews), where
// there is nothing to fill.
export type ParentLayout = "row" | "column" | "free";

export const ParentLayoutContext = createContext<ParentLayout | null>(null);

export const flexLayout = (direction: string | undefined): ParentLayout =>
  direction?.startsWith("row") ? "row" : "column";

// The styles that make an element fill its parent along the sides it is set to, to be spread
// over the element's own (they replace its width and height on those sides). `width`/`height`
// say which sides fill, so renderers can turn their resize handles off for them.
export const useFill = (element: { type: ElementType; style: ElementStyle | null }) => {
  const layout = useContext(ParentLayoutContext);
  const fill = fillOf(element);
  const width = fill.width && layout !== null;
  const height = fill.height && layout !== null;

  const style: React.CSSProperties = {};
  // Grows into the room left along the parent's direction, and may shrink below its content.
  const grow = (side: "width" | "height") =>
    Object.assign(style, {
      [side]: "auto",
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 0,
      [side === "width" ? "minWidth" : "minHeight"]: 0,
    });
  // Stretched across the parent's direction.
  const stretch = (side: "width" | "height") =>
    Object.assign(style, { [side]: "auto", alignSelf: "stretch" });

  if (layout === "free") {
    if (width) style.width = "100%";
    if (height) style.height = "100%";
  } else if (layout === "row") {
    if (width) grow("width");
    if (height) stretch("height");
  } else if (layout === "column") {
    if (height) grow("height");
    if (width) stretch("width");
  }
  // A side that fills has no maximum of its own either.
  if (width) style.maxWidth = "none";
  if (height) style.maxHeight = "none";

  return { width, height, style };
};
