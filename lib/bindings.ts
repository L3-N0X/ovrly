import { isSourceName, isVariableName } from "./variables";

// Which properties of which element types can be bound to a variable (VariableBinding), and
// what kind of value each one takes. Mirrored, with labels, by src/lib/bindings.ts.
//
// Properties are named the way the element stores them: "text" (a title's), "value" (a
// counter's) and "src" (an image's) are content, anything under "style." is design.

export type BindingKind = "text" | "number" | "color" | "image" | "boolean";

// Where an element sits in a group or on a free canvas.
const POSITION = { "style.x": "number", "style.y": "number" } as const;

// The drop shadow every element can have.
const SHADOW = {
  "style.shadowColor": "color",
  "style.shadowX": "number",
  "style.shadowY": "number",
  "style.shadowBlur": "number",
  "style.shadowSpread": "number",
} as const;

const TEXT_STYLE = {
  "style.color": "color",
  "style.fontSize": "number",
} as const;

const BOX_STYLE = {
  ...TEXT_STYLE,
  "style.backgroundColor": "color",
  "style.padding": "number",
  "style.radius": "number",
} as const;

export const BINDABLE_PROPERTIES: Record<string, Record<string, BindingKind>> = {
  TITLE: { text: "text", ...TEXT_STYLE, ...POSITION, ...SHADOW },
  COUNTER: { value: "number", ...BOX_STYLE, ...POSITION, ...SHADOW },
  TIMER: { ...BOX_STYLE, ...POSITION, ...SHADOW },
  COUNTDOWN: { ...BOX_STYLE, ...POSITION, ...SHADOW },
  IMAGE: {
    src: "image",
    "style.width": "number",
    "style.height": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...SHADOW,
  },
  ICON: { "style.color": "color", "style.size": "number", ...POSITION, ...SHADOW },
  BINGO: {
    "style.width": "number",
    "style.fontSize": "number",
    "style.color": "color",
    "style.backgroundColor": "color",
    "style.backgroundImage": "image",
    "style.backgroundImageOpacity": "number",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    "style.gridLines": "boolean",
    "style.gridLineColor": "color",
    "style.gridLineWidth": "number",
    "style.gap": "number",
    "style.padding": "number",
    "style.checkedCrossColor": "color",
    "style.crossThickness": "number",
    "style.crossOpacity": "number",
    ...POSITION,
    ...SHADOW,
  },
  CONTAINER: {
    "style.width": "number",
    "style.height": "number",
    "style.gap": "number",
    "style.paddingX": "number",
    "style.paddingY": "number",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...SHADOW,
  },
  GROUP: {
    "style.width": "number",
    "style.height": "number",
    "style.clip": "boolean",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.radius": "number",
    ...POSITION,
    ...SHADOW,
  },
  RECTANGLE: {
    "style.width": "number",
    "style.height": "number",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...SHADOW,
  },
};

export const isBindableProperty = (elementType: string, property: unknown): property is string =>
  typeof property === "string" && Object.hasOwn(BINDABLE_PROPERTIES[elementType] ?? {}, property);

// Content is what controllers change while live; the rest is design, which needs an editor.
export const isContentProperty = (property: string) => !property.startsWith("style.");

export interface BindingTarget {
  source: string;
  key: string;
}

// The variable a binding names, when it names a valid one.
export const parseBindingTarget = (value: unknown): BindingTarget | null => {
  const target = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return isSourceName(target.source) && isVariableName(target.key)
    ? { source: target.source, key: target.key }
    : null;
};

// Presets name the Twitch channel of whoever creates an overlay from them with this source;
// it is replaced by "twitch:<their login>" (routes/overlays.ts).
export const OWN_TWITCH_SOURCE = "twitch:@me";

// The bindings of an element copied from presets, imports and duplicates, which may be user
// supplied: only valid ones of properties its type has are taken over.
export const bindingSeeds = (elementType: string, value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seeds = new Map<string, BindingTarget & { property: string }>();
  for (const item of value) {
    const property = (item as { property?: unknown } | null)?.property;
    const target = parseBindingTarget(item);
    if (target && isBindableProperty(elementType, property)) {
      seeds.set(property, { property, ...target });
    }
  }
  return [...seeds.values()];
};
