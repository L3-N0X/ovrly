export const ElementTypeEnum = {
  COUNTER: "COUNTER",
  TITLE: "TITLE",
  GROUP: "GROUP",
} as const;

export type ElementType = (typeof ElementTypeEnum)[keyof typeof ElementTypeEnum];

// Global styles for the overlay container
export interface GlobalStyle {
  // For the outer container (group alignment)
  groupJustifyContent?: "flex-start" | "center" | "flex-end";
  groupAlignItems?: "flex-start" | "center" | "flex-end";

  // For the inner container (element alignment)
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  gap?: number;
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";

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

// Specific style for a Group element
export interface GroupStyle {
  flexDirection?: "row" | "column";
  gap?: number;
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  backgroundColor?: string;
  padding?: number;
  radius?: number;
}

// A union of all possible element style types
export type ElementStyle = BaseElementStyle | CounterStyle | GroupStyle;

// The generic Element object from the backend
export interface PrismaElement {
  id: string;
  name: string;
  type: ElementType;
  style: ElementStyle;
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
  globalStyle: GlobalStyle | null;
  elements: PrismaElement[];
  userId: string;
}
