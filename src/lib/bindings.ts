import type {
  ElementType,
  OverlayVariable,
  PrismaElement,
  PrismaOverlay,
  VariableBinding,
  VariableType,
} from "./types";
import { formatVariableValue, variableRef } from "./variables";

// Which element properties can be bound to a variable, and what kind of value each takes.
// Mirrors lib/bindings.ts on the server, which checks the property names.
//
// A bound property shows the variable's value instead of its own: overlays carry the values of the
// variables they are bound to (`overlay.variables`), and `resolveOverlay` puts them in place before
// anything is drawn, so renderers never know whether a value was bound.

export type BindingKind = "text" | "number" | "color" | "image" | "boolean";

// The variable types each kind of property accepts. Any number can be shown as text.
export const KIND_TYPES: Record<BindingKind, VariableType[]> = {
  text: ["STRING", "INTEGER", "DOUBLE"],
  number: ["INTEGER", "DOUBLE"],
  color: ["COLOR"],
  image: ["IMAGE"],
  boolean: ["BOOLEAN"],
};

export const KIND_LABELS: Record<BindingKind, string> = {
  text: "text or number",
  number: "number",
  color: "color",
  image: "image",
  boolean: "yes/no",
};

export const acceptsType = (kind: BindingKind, type: VariableType) => KIND_TYPES[kind].includes(type);

// Where an element sits in a group or on a free canvas.
const POSITION = { "style.x": "number", "style.y": "number" } as const;

// Whether the element is drawn at all; every element type has it.
const VISIBILITY = { "style.visible": "boolean" } as const;

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

const TIMER_STYLE = {
  ...BOX_STYLE,
  "style.paddingX": "number",
  "style.paddingY": "number",
} as const;

export const BINDABLE_PROPERTIES: Record<ElementType, Record<string, BindingKind>> = {
  TITLE: {
    text: "text",
    ...TEXT_STYLE,
    "style.paddingX": "number",
    "style.paddingY": "number",
    ...POSITION,
    ...VISIBILITY,
  },
  COUNTER: { value: "number", ...BOX_STYLE, ...POSITION, ...VISIBILITY },
  TIMER: { ...TIMER_STYLE, ...POSITION, ...VISIBILITY },
  COUNTDOWN: { ...TIMER_STYLE, ...POSITION, ...VISIBILITY },
  SUBATHON: { ...TIMER_STYLE, ...POSITION, ...VISIBILITY },
  IMAGE: {
    src: "image",
    "style.width": "number",
    "style.height": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...VISIBILITY,
  },
  ICON: { "style.color": "color", "style.size": "number", ...POSITION, ...VISIBILITY },
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
    ...VISIBILITY,
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
    ...VISIBILITY,
  },
  SCROLLER: {
    "style.width": "number",
    "style.height": "number",
    "style.speed": "number",
    "style.pause": "number",
    "style.gap": "number",
    "style.paddingX": "number",
    "style.paddingY": "number",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...VISIBILITY,
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
    ...VISIBILITY,
  },
  RECTANGLE: {
    "style.width": "number",
    "style.height": "number",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...VISIBILITY,
  },
  PROGRESS: {
    value: "number",
    max: "number",
    running: "boolean",
    "style.width": "number",
    "style.height": "number",
    "style.fillColor": "color",
    "style.backgroundColor": "color",
    "style.borderColor": "color",
    "style.borderWidth": "number",
    "style.borderRadius": "number",
    ...POSITION,
    ...VISIBILITY,
  },
};

export const bindingKind = (type: ElementType, property: string): BindingKind | undefined =>
  BINDABLE_PROPERTIES[type]?.[property];

// Content is what controllers change while live; the rest is design.
export const isContentProperty = (property: string) => !property.startsWith("style.");

export const bindingOf = (element: PrismaElement, property: string): VariableBinding | undefined =>
  element.bindings?.find((binding) => binding.property === property);

// The value a property of `kind` shows for a variable, or undefined when the variable doesn't fit
// it (an application changed its type), so the property keeps its own value.
const valueFor = (kind: BindingKind, variable: OverlayVariable) => {
  if (!acceptsType(kind, variable.type)) return undefined;
  return kind === "text" ? formatVariableValue(variable.type, variable.value) : variable.value;
};

// The element as it is shown: every bound property that has a fitting variable carries the
// variable's value. Returns the element itself when nothing changes.
export const resolveElement = (
  element: PrismaElement,
  variables: Map<string, OverlayVariable>
): PrismaElement => {
  if (!element.bindings?.length) return element;
  let resolved = element;
  for (const binding of element.bindings) {
    const kind = bindingKind(element.type, binding.property);
    const variable = variables.get(variableRef(binding));
    const value = kind && variable ? valueFor(kind, variable) : undefined;
    if (value === undefined) continue;
    if (resolved === element) resolved = { ...element };
    if (binding.property.startsWith("style.")) {
      resolved.style = { ...resolved.style, [binding.property.slice("style.".length)]: value };
    } else if (binding.property === "text" && resolved.title) {
      resolved.title = { ...resolved.title, text: String(value) };
    } else if (binding.property === "value" && resolved.counter) {
      resolved.counter = { ...resolved.counter, value: Number(value) };
    } else if (
      (binding.property === "value" || binding.property === "max" || binding.property === "running") &&
      resolved.progress
    ) {
      resolved.progress = { ...resolved.progress, [binding.property]: value };
    } else if (binding.property === "src" && resolved.image) {
      resolved.image = { ...resolved.image, src: String(value) };
    }
  }
  return resolved;
};

export const variablesByRef = (variables: OverlayVariable[] = []) =>
  new Map(variables.map((variable) => [variableRef(variable), variable]));

// The overlay as it is shown, with every bound property resolved (see resolveElement).
export const resolveOverlay = (overlay: PrismaOverlay): PrismaOverlay => {
  if (!overlay.elements.some((element) => element.bindings?.length)) return overlay;
  const variables = variablesByRef(overlay.variables);
  return { ...overlay, elements: overlay.elements.map((el) => resolveElement(el, variables)) };
};
