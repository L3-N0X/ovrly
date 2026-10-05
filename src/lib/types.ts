export const ElementTypeEnum = {
  COUNTER: "COUNTER",
  TITLE: "TITLE",
  CONTAINER: "CONTAINER",
  TIMER: "TIMER",
  IMAGE: "IMAGE",
  GROUP: "GROUP",
} as const;

// Element types that hold other elements.
export const isParentType = (type: ElementType) =>
  type === ElementTypeEnum.CONTAINER || type === ElementTypeEnum.GROUP;

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

// Groups start out covering the whole 800x600 canvas.
export const DEFAULT_GROUP_WIDTH = 800;
export const DEFAULT_GROUP_HEIGHT = 600;

// Specific style for a Group element: a fixed-size area whose children are placed freely
export interface GroupStyle extends BaseElementStyle {
  width?: number;
  height?: number;
  backgroundColor?: string;
  radius?: number;
}

// A union of all possible element style types
export type ElementStyle =
  | BaseElementStyle
  | CounterStyle
  | ContainerStyle
  | TimerStyle
  | ImageStyle
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
