// Components: elements saved to add to any overlay (the Component model). Their tree is stored,
// exported and imported in one format, the one presets use too (src/lib/presets.ts), with
// nothing tied to where it came from: no ids, positions, running state or Twitch channel.
// Mirrored by src/lib/components.ts.

import { normalizeBingoState } from "./bingo";
import { bindingSeeds } from "./bindings";
import { countdownSeed } from "./countdown";
import { iconSeed } from "./icons";
import { ELEMENT_TYPE_NAMES } from "./naming";
import { progressSeed } from "./progress";
import { isStyleObject } from "./style";
import { subathonSeed } from "./subathon";

// What a component file says it is, so a random JSON file (or an overlay export) isn't taken
// for one.
export const COMPONENT_FORMAT = "ovrly-component";
export const COMPONENT_FORMAT_VERSION = 1;

export const MAX_COMPONENT_ELEMENTS = 500;
export const MAX_COMPONENT_DEPTH = 32;
// Images are copied into the account that adds the component, one upload each.
export const MAX_COMPONENT_IMAGES = 50;
// The size of a component file, and of the elements of one stored component.
export const MAX_COMPONENT_BYTES = 2 * 1024 * 1024;
export const MAX_COMPONENT_NAME_LENGTH = 100;
export const MAX_COMPONENT_DESCRIPTION_LENGTH = 500;
const MAX_ELEMENT_NAME_LENGTH = 100;

const PARENT_TYPES = new Set(["CONTAINER", "GROUP", "SCROLLER", "CYCLE_STACK"]);

type Json = Record<string, unknown>;

export interface ComponentElement {
  name: string;
  type: string;
  style: Json;
  title?: { text: string };
  counter?: { value: number };
  countdown?: { mode: "DURATION" | "TARGET"; duration?: number; targetAt: string | null };
  subathon?: Json;
  bindings?: { property: string; source: string; key: string }[];
  image?: { src: string };
  icon?: { library: string; name: string };
  progress?: { value: number; max: number; running: boolean };
  bingo?: ReturnType<typeof normalizeBingoState>;
  children?: ComponentElement[];
}

const asObject = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};

/**
 * The elements of a component from user supplied (or stored) data: only element types that
 * exist, with their own kind of content, are taken over, and children only by elements that
 * hold some. The x/y of the top elements are dropped, they placed them in the overlay they came
 * from. Answers with a message instead when there is nothing to save or it is too much.
 */
export const parseComponentElements = (value: unknown): ComponentElement[] | string => {
  if (!Array.isArray(value) || value.length === 0) return "A component needs at least one element";
  let count = 0;
  let images = 0;
  let error: string | null = null;

  const parse = (nodes: unknown[], depth: number): ComponentElement[] =>
    nodes.flatMap((raw): ComponentElement[] => {
      if (error) return [];
      const node = asObject(raw);
      const type = node.type;
      if (typeof type !== "string" || !Object.hasOwn(ELEMENT_TYPE_NAMES, type)) return [];
      if (++count > MAX_COMPONENT_ELEMENTS) {
        error = `A component can have at most ${MAX_COMPONENT_ELEMENTS} elements`;
        return [];
      }
      if (depth > MAX_COMPONENT_DEPTH) {
        error = `Elements can be nested at most ${MAX_COMPONENT_DEPTH} levels deep`;
        return [];
      }

      const style = isStyleObject(node.style) ? { ...node.style } : {};
      if (depth === 0) {
        delete style.x;
        delete style.y;
      }
      const name =
        typeof node.name === "string" && node.name.trim()
          ? node.name.trim().slice(0, MAX_ELEMENT_NAME_LENGTH)
          : ELEMENT_TYPE_NAMES[type];
      const element: ComponentElement = { name, type, style };

      if (type === "TITLE") {
        const text = asObject(node.title).text;
        element.title = { text: typeof text === "string" ? text : "" };
      }
      if (type === "COUNTER") {
        const counterValue = asObject(node.counter).value;
        element.counter = {
          value: typeof counterValue === "number" && Number.isFinite(counterValue) ? counterValue : 0,
        };
      }
      if (type === "COUNTDOWN") {
        const { mode, duration, targetAt } = countdownSeed(node.countdown);
        element.countdown = { mode, duration, targetAt: targetAt?.toISOString() ?? null };
      }
      if (type === "SUBATHON") {
        // Its settings only; it starts out paused at its starting length.
        const settings: Json = subathonSeed(node.subathon);
        delete settings.remaining;
        element.subathon = settings;
      }
      if (type === "IMAGE") {
        const src = asObject(node.image).src;
        element.image = { src: typeof src === "string" ? src : "" };
        if (element.image.src && ++images > MAX_COMPONENT_IMAGES) {
          error = `A component can have at most ${MAX_COMPONENT_IMAGES} images`;
          return [];
        }
      }
      if (type === "ICON") element.icon = iconSeed(node.icon);
      if (type === "PROGRESS") element.progress = progressSeed(node.progress);
      if (type === "BINGO") element.bingo = normalizeBingoState(node.bingo);

      const bindings = bindingSeeds(type, node.bindings);
      if (bindings.length > 0) element.bindings = bindings;

      if (PARENT_TYPES.has(type) && Array.isArray(node.children) && node.children.length > 0) {
        element.children = parse(node.children, depth + 1);
      }
      return [element];
    });

  const elements = parse(value, 0);
  if (error) return error;
  if (elements.length === 0) return "A component needs at least one element";
  if (JSON.stringify(elements).length > MAX_COMPONENT_BYTES) return "This component is too big";
  return elements;
};

// Calls `visit` with every element of a component tree, nested ones included.
export const forEachComponentElement = (
  elements: ComponentElement[],
  visit: (element: ComponentElement) => void
) => {
  for (const element of elements) {
    visit(element);
    if (element.children) forEachComponentElement(element.children, visit);
  }
};

// A component's name and description, trimmed; null when the name is missing or too long.
export const parseComponentName = (value: unknown) =>
  typeof value === "string" && value.trim() && value.trim().length <= MAX_COMPONENT_NAME_LENGTH
    ? value.trim()
    : null;

export const parseComponentDescription = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || value.length > MAX_COMPONENT_DESCRIPTION_LENGTH) return undefined;
  return value.trim() || null;
};
