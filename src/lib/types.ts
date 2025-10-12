export const ElementTypeEnum = {
  COUNTER: "COUNTER",
  TITLE: "TITLE",
  CONTAINER: "CONTAINER",
} as const;

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
}

// Specific style for a Counter element
export interface CounterStyle extends BaseElementStyle {
  backgroundColor?: string;
  padding?: number;
  radius?: number;
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

// A union of all possible element style types
export type ElementStyle = BaseElementStyle | CounterStyle | ContainerStyle;

// The generic Element object from the backend
export interface PrismaElement {
  id: string;
  name: string;
  type: ElementType;
  style: ElementStyle | null;
  title?: { id: string; text: string } | null;
  counter?: { id: string; value: number } | null;
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
