export const ElementTypeEnum = {
  COUNTER: "COUNTER",
  TITLE: "TITLE",
  CONTAINER: "CONTAINER",
  TIMER: "TIMER",
  IMAGE: "IMAGE",
  BINGO: "BINGO",
  GROUP: "GROUP",
} as const;

// Element types that hold other elements.
export const isParentType = (type: ElementType) =>
  type === ElementTypeEnum.CONTAINER || type === ElementTypeEnum.GROUP;

// Element types with content of their own (text, a value, ...) that can be changed while
// live. Containers and groups only arrange other elements.
export const hasContent = (type: ElementType) =>
  type === ElementTypeEnum.TITLE ||
  type === ElementTypeEnum.COUNTER ||
  type === ElementTypeEnum.TIMER ||
  type === ElementTypeEnum.IMAGE ||
  type === ElementTypeEnum.BINGO;

export type ElementType = (typeof ElementTypeEnum)[keyof typeof ElementTypeEnum];

// Global styles for the overlay container
export interface GlobalStyle {
  // For the outer container (overall alignment in 800x600 space)
  outerJustifyContent?: "flex-start" | "center" | "flex-end";
  outerAlignItems?: "flex-start" | "center" | "flex-end" | "baseline";


  // For the inner container (element alignment within the group)
  innerJustifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  innerAlignItems?: "flex-start" | "center" | "flex-end" | "baseline";
  // Old property names for backward compatibility
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "baseline";

  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  gap?: number;

  top: number;
  left: number;

  // General appearance (for the inner container)
  backgroundColor?: string;
  padding?: number;
  radius?: number;
}

// Base style for any element
export interface BaseElementStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  // Offset from the top left corner of the parent, used when the parent is a GROUP.
  x?: number;
  y?: number;
}

// Specific style for a Counter element
export interface CounterStyle extends BaseElementStyle {
  backgroundColor?: string;
  padding?: number;
  radius?: number;
}

// Specific style for a Timer element
export interface TimerStyle extends BaseElementStyle {
  backgroundColor?: string;
  padding?: number;
  radius?: number;
  format?: string;
}

// Specific style for an Image element
export interface ImageStyle extends BaseElementStyle {
  width?: number;
  height?: number;
  objectFit?: "cover" | "contain";
  imageRendering?: "pixelated" | "auto";
  borderRadius?: number;
}

// Specific style for a Container element
export interface ContainerStyle extends BaseElementStyle {
  paddingX?: number;
  paddingY?: number;
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
}

// The size of the overlay as OBS renders it.
export const OVERLAY_WIDTH = 800;
export const OVERLAY_HEIGHT = 600;

// Groups start out covering the whole canvas.
export const DEFAULT_GROUP_WIDTH = OVERLAY_WIDTH;
export const DEFAULT_GROUP_HEIGHT = OVERLAY_HEIGHT;

// Specific style for a Group element: a fixed-size area whose children are placed freely
export interface GroupStyle extends BaseElementStyle {
  width?: number;
  height?: number;
  backgroundColor?: string;
  radius?: number;
}

// Specific style for a Bingo element
export interface BingoStyle extends BaseElementStyle {
  /** Card size in pixels. Both are required for a predictable grid, so the
   * editor exposes sliders rather than letting the card fill its parent. */
  width?: number;
  height?: number;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  checkedBackgroundColor?: string;
  checkedColor?: string;
  /** Colour of the cross drawn over a marked cell. Kept separate from
   * `checkedColor` so the mark stays legible against the cell background. */
  checkedCrossColor?: string;
  /** Cross thickness in pixels. */
  crossWidth?: number;
}

// A union of all possible element style types
export type ElementStyle =
  | BaseElementStyle
  | CounterStyle
  | ContainerStyle
  | TimerStyle
  | ImageStyle
  | BingoStyle
  | GroupStyle;

// The generic Element object from the backend
export interface PrismaElement {
  id: string;
  name: string;
  type: ElementType;
  position?: number | null;
  style: ElementStyle | null;
  title?: { id: string; text: string } | null;
  counter?: { id: string; value: number } | null;
  timer?: { id: string; startedAt: string | null; pausedAt: string | null; duration: number | null; countDown: boolean; } | null;
  image?: { id: string; src: string } | null;
  bingo?: {
    id: string;
    size: number;
    freeMiddle: boolean;
    fields: string[];
    checked: boolean[];
  } | null;
  parentId?: string | null;
  children?: PrismaElement[];
}

// The main Overlay object from the backend
export interface PrismaOverlay {
  id: string;
  name: string;
  description?: string | null;
  /**
   * Optional icon filename for the overlay (e.g. "simple-counter.svg").
   * Stored as a filename relative to the public/presets/icons/ directory.
   */
  icon?: string | null;
  globalStyle: GlobalStyle | null;
  elements: PrismaElement[];
  userId: string;
}

// What onOverlayChange accepts: the next overlay, or a function that derives it from the
// latest state. Use the function form after an `await`, where a captured overlay may be
// stale and would write older styles back over newer ones.
export type OverlayChange = PrismaOverlay | ((current: PrismaOverlay) => PrismaOverlay);
export type OnOverlayChange = (change: OverlayChange) => void;
