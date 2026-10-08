import type { AccessRole } from "./sharing";

export const ElementTypeEnum = {
  COUNTER: "COUNTER",
  TITLE: "TITLE",
  CONTAINER: "CONTAINER",
  TIMER: "TIMER",
  COUNTDOWN: "COUNTDOWN",
  IMAGE: "IMAGE",
  BINGO: "BINGO",
  GROUP: "GROUP",
  ICON: "ICON",
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
  type === ElementTypeEnum.COUNTDOWN ||
  type === ElementTypeEnum.IMAGE ||
  type === ElementTypeEnum.ICON ||
  type === ElementTypeEnum.BINGO;

export type ElementType =
  (typeof ElementTypeEnum)[keyof typeof ElementTypeEnum];

export type CountdownMode = "DURATION" | "TARGET";

// The icon libraries an icon element can use (see src/lib/icons.ts).
export type IconLibrary = "lucide" | "phosphor" | "pixelarticons" | "tabler";

// The types variables can have (see src/lib/variables.ts). IMAGE values are image URLs.
export type VariableType =
  "STRING" | "INTEGER" | "DOUBLE" | "BOOLEAN" | "COLOR" | "IMAGE";

export type VariableValue = string | number | boolean;

// A variable of the overlay's owner, as overlays carry the ones their elements are bound to.
export interface OverlayVariable {
  // "scores", or "<provider>:<name>" for a provider's ("twitch:shroud").
  source: string;
  key: string;
  type: VariableType;
  value: VariableValue;
}

// A property of an element that shows a variable instead of its own value (see
// src/lib/bindings.ts).
export interface VariableBinding {
  // "text", "value", "src", or "style.<key>".
  property: string;
  source: string;
  key: string;
}

// How the elements that sit directly on the canvas are placed. The canvas itself is the
// overlay's root group: in AUTO mode its children are laid out by the global arrangement (a
// flex row or column with gaps), in FREE mode each one is placed by its own x/y.
export const CanvasModeEnum = {
  AUTO: "AUTO",
  FREE: "FREE",
} as const;

export type CanvasMode = (typeof CanvasModeEnum)[keyof typeof CanvasModeEnum];

// Global styles for the overlay container
export interface GlobalStyle {
  // For the outer container (overall alignment in canvas space)
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
  justifyContent?:
    "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
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
  /** A CSS font-weight number; see `FONT_WEIGHTS` in lib/fonts.ts. */
  fontWeight?: number;
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

// Specific style for a Timer or Countdown element
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

// Specific style for an Icon element. The icon is drawn in `color` at `size` by `size` pixels.
export interface IconStyle extends BaseElementStyle {
  size?: number;
}

// Specific style for a Container element
export interface ContainerStyle extends BaseElementStyle {
  /** Both sizes are automatic unless switched off: the container fills its parent's width and grows with its children. */
  autoWidth?: boolean;
  autoHeight?: boolean;
  /** Used for the sides that are not automatic. */
  width?: number;
  height?: number;
  paddingX?: number;
  paddingY?: number;
  gap?: number;
  /** Transparent by default, so a container only arranges its children until it is given a fill. */
  backgroundColor?: string;
  /** White by default; only drawn once `borderWidth` is above 0. */
  borderColor?: string;
  /** 0 by default, which draws no border at all. */
  borderWidth?: number;
  /** 0 by default, so the corners are square. */
  borderRadius?: number;
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

// The size a canvas has when an overlay says nothing: 1920x1080, the usual stream size.
export const DEFAULT_CANVAS_WIDTH = 1920;
export const DEFAULT_CANVAS_HEIGHT = 1080;

// A canvas smaller than this has no room to place anything in.
export const MIN_CANVAS_SIZE = 16;
// Large enough for an 8K source.
export const MAX_CANVAS_SIZE = 7680;

// The canvas size of an overlay, falling back to the default when it has none stored.
export const canvasSize = (overlay: {
  width?: number | null;
  height?: number | null;
}) => ({
  width: overlay.width ?? DEFAULT_CANVAS_WIDTH,
  height: overlay.height ?? DEFAULT_CANVAS_HEIGHT,
});

// Groups start out covering the whole canvas they are added to, which the overlay decides.
export const DEFAULT_GROUP_WIDTH = DEFAULT_CANVAS_WIDTH;
export const DEFAULT_GROUP_HEIGHT = DEFAULT_CANVAS_HEIGHT;

// What a container's side is set to when automatic sizing is switched off and nothing measures it.
export const DEFAULT_CONTAINER_WIDTH = 400;
export const DEFAULT_CONTAINER_HEIGHT = 200;

// Groups and containers are invisible boxes until they are styled: no fill, no stroke, square
// corners. The stroke colour is white anyway, so raising the width is all it takes to draw a
// border around them.
export const DEFAULT_BORDER_COLOR = "#ffffff";
export const DEFAULT_BORDER_WIDTH = 0;
export const DEFAULT_BORDER_RADIUS = 0;

export const BORDER_WIDTH_RANGE = { min: 0, max: 100 };
export const BORDER_RADIUS_RANGE = { min: 0, max: 200 };

// Specific style for a Group element: a fixed-size area whose children are placed freely
export interface GroupStyle extends BaseElementStyle {
  width?: number;
  height?: number;
  // Hides whatever sticks out of the group. Off by default, so elements can be moved past
  // its edges (and the overlay's).
  clip?: boolean;
  /** Transparent by default, so a group only arranges its children until it is given a fill. */
  backgroundColor?: string;
  /** White by default; only drawn once `borderWidth` is above 0. */
  borderColor?: string;
  /** 0 by default, which draws no border at all. */
  borderWidth?: number;
  /** 0 by default, so the corners are square. */
  radius?: number;
}

// Specific style for a Bingo element
export interface BingoStyle extends BaseElementStyle {
  /** Card width in pixels. The height follows from it, so that every cell is square. */
  width?: number;
  /** No longer used: cards saved before cells were always square may still carry it. */
  height?: number;
  backgroundColor?: string;
  /** URL of an image drawn behind the cells, above the background colour. */
  backgroundImage?: string;
  backgroundImageFit?: "cover" | "contain" | "fill";
  /** 0–100. */
  backgroundImageOpacity?: number;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  gap?: number;
  /** Draws table lines between all cells. The cells then sit directly on the lines, so
   * `gap` is replaced by `gridLineWidth` and `padding` is not used. */
  gridLines?: boolean;
  gridLineColor?: string;
  gridLineWidth?: number;
  /** Colour of the cross drawn behind the label of a marked cell. */
  checkedCrossColor?: string;
  /** Cross thickness in percent of the cell size. */
  crossThickness?: number;
  /** 0–100, so the label stays readable on top of the cross. */
  crossOpacity?: number;
  crossStyle?: "brush" | "line";
}

// A union of all possible element style types
export type ElementStyle =
  | BaseElementStyle
  | CounterStyle
  | ContainerStyle
  | TimerStyle
  | ImageStyle
  | IconStyle
  | BingoStyle
  | GroupStyle;

// The generic Element object from the backend
export interface PrismaElement {
  id: string;
  // Sent by the server; elements built on the client (preset previews) have none.
  overlayId?: string;
  name: string;
  type: ElementType;
  position?: number | null;
  style: ElementStyle | null;
  title?: { id: string; text: string } | null;
  counter?: { id: string; value: number } | null;
  timer?: {
    id: string;
    startedAt: string | null;
    pausedAt: string | null;
  } | null;
  countdown?: {
    id: string;
    // DURATION counts down `duration` (started, paused and reset like a timer); TARGET counts
    // down to `targetAt` and always runs.
    mode: CountdownMode;
    duration: number;
    // The time left while paused; while running, it ends at `endsAt`.
    remaining: number;
    endsAt: string | null;
    targetAt: string | null;
  } | null;
  image?: { id: string; src: string } | null;
  icon?: { id: string; library: IconLibrary; name: string } | null;
  bingo?: {
    id: string;
    rows: number;
    columns: number;
    freeMiddle: boolean;
    fields: string[];
    checked: boolean[];
  } | null;
  // Properties driven by variables; missing on elements built on the client (preset previews).
  bindings?: VariableBinding[];
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
  // The size of the canvas as OBS renders it.
  width: number;
  height: number;
  // Whether the elements directly on the canvas are laid out or placed freely.
  canvasMode: CanvasMode;
  // Increases with every broadcast of the overlay; a lower one is older state.
  revision: number;
  // The owner's variables its elements are bound to (and only those).
  variables?: OverlayVariable[];
}

// What onOverlayChange accepts: the next overlay, or a function that derives it from the
// latest state. Use the function form after an `await`, where a captured overlay may be
// stale and would write older styles back over newer ones.
export type OverlayChange =
  PrismaOverlay | ((current: PrismaOverlay) => PrismaOverlay);
export type OnOverlayChange = (change: OverlayChange) => void;

// Someone who can open an overlay: its owner, or someone it was shared with (directly or
// through the owner's team).
export interface OverlayMember {
  name: string;
  image: string | null;
  role: AccessRole;
  // Invited by Twitch name, but hasn't signed in yet.
  pending: boolean;
}

// An overlay as listed on the home page.
export interface OverlaySummary extends PrismaOverlay {
  createdAt: string;
  updatedAt: string;
  members: OverlayMember[];
  // What the current user may do with it.
  myRole: AccessRole;
}
