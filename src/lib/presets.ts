import { normalizeBingoData } from "./bingo";
import { DEFAULT_ICON } from "./icons";
import { DEFAULT_PROGRESS } from "./progress";
import {
  CanvasModeEnum,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  ElementTypeEnum,
  type CanvasMode,
  type ElementStyle,
  type ElementType,
  type GlobalStyle,
  type IconLibrary,
  type PrismaElement,
  type PrismaOverlay,
  type VariableBinding,
} from "./types";

// An element of a template, nested the way it is stored in overlay-presets.json.
export interface PresetElement {
  name: string;
  type: ElementType;
  style?: ElementStyle;
  title?: { text: string };
  counter?: { value: number };
  countdown?: Partial<Pick<NonNullable<PrismaElement["countdown"]>, "mode" | "duration">>;
  subathon?: Partial<
    Pick<
      NonNullable<PrismaElement["subathon"]>,
      "duration" | "tier1Ms" | "tier2Ms" | "tier3Ms" | "bitsMs" | "maxRemaining" | "countWhilePaused"
    >
  >;
  // "twitch:@me" stands for the Twitch channel of whoever creates the overlay.
  bindings?: VariableBinding[];
  image?: { src: string };
  icon?: { library: IconLibrary; name: string };
  progress?: { value?: number; max?: number; running?: boolean };
  bingo?: Partial<NonNullable<PrismaElement["bingo"]>>;
  children?: PresetElement[];
}

// A template a new overlay can start from (public/presets/overlay-presets.json).
export interface OverlayPreset {
  id: string;
  name: string;
  description: string;
  globalStyle?: GlobalStyle;
  elements: PresetElement[];
  width?: number;
  height?: number;
  canvasMode?: CanvasMode;
}

// What a new countdown counts down from, as on the server (prisma/schema.prisma).
const DEFAULT_COUNTDOWN_MS = 5 * 60 * 1000;

// A new subathon, as on the server (prisma/schema.prisma).
const DEFAULT_SUBATHON: Omit<NonNullable<PrismaElement["subathon"]>, "id"> = {
  duration: 60 * 60 * 1000,
  remaining: 60 * 60 * 1000,
  endsAt: null,
  channelId: null,
  tier1Ms: 5 * 60 * 1000,
  tier2Ms: 10 * 60 * 1000,
  tier3Ms: 25 * 60 * 1000,
  bitsMs: 60 * 1000,
  multiplier: 1,
  maxRemaining: null,
  countWhilePaused: true,
  subs: 0,
  bits: 0,
  addedMs: 0,
  lastAddedMs: 0,
  lastAddedAt: null,
};

export const fetchPresets = async (): Promise<OverlayPreset[]> => {
  const response = await fetch("/presets/overlay-presets.json");
  if (!response.ok) throw new Error("Failed to fetch presets");
  const data = await response.json();
  return data.presets;
};

// The elements a tree of seeds (a template's, or a component's) turns into, so they can be
// previewed with the real renderer before they are created. The ids are made up from `idPrefix`;
// nothing here is ever saved.
export const seedsToElements = (seeds: PresetElement[], idPrefix: string): PrismaElement[] => {
  const elements: PrismaElement[] = [];
  const add = (seeds: PresetElement[], parentId: string | null, path: string) =>
    seeds.forEach((seed, position) => {
      const id = `${idPrefix}/${path}${position}`;
      elements.push({
        id,
        name: seed.name,
        type: seed.type,
        position,
        parentId,
        style: seed.style ?? {},
        title: seed.title ? { id, ...seed.title } : null,
        counter: seed.counter ? { id, ...seed.counter } : null,
        // Timers and countdowns start out stopped, so their seeds only say how long.
        timer: seed.type === ElementTypeEnum.TIMER ? { id, startedAt: null, pausedAt: null } : null,
        countdown:
          seed.type === ElementTypeEnum.COUNTDOWN
            ? {
                id,
                mode: seed.countdown?.mode ?? "DURATION",
                duration: seed.countdown?.duration ?? DEFAULT_COUNTDOWN_MS,
                remaining: seed.countdown?.duration ?? DEFAULT_COUNTDOWN_MS,
                endsAt: null,
                targetAt: null,
              }
            : null,
        subathon:
          seed.type === ElementTypeEnum.SUBATHON
            ? {
                id,
                ...DEFAULT_SUBATHON,
                ...seed.subathon,
                remaining: seed.subathon?.duration ?? DEFAULT_SUBATHON.duration,
              }
            : null,
        // Previews have no variables, so bound fields show the template's own values.
        bindings: seed.bindings ?? [],
        icon:
          seed.type === ElementTypeEnum.ICON
            ? { id, ...(seed.icon ?? DEFAULT_ICON) }
            : null,
        progress:
          seed.type === ElementTypeEnum.PROGRESS
            ? { id, ...DEFAULT_PROGRESS, ...seed.progress }
            : null,
        // Cycle stacks cycle from the start, as they do once they are created.
        cycleStack:
          seed.type === ElementTypeEnum.CYCLE_STACK
            ? { id, index: 0, startedAt: new Date(0).toISOString() }
            : null,
        image: seed.image ? { id, ...seed.image } : null,
        bingo: seed.bingo
          ? { id, ...normalizeBingoData(seed.bingo as PrismaElement["bingo"]) }
          : null,
      });
      if (seed.children) add(seed.children, id, `${path}${position}/`);
    });
  add(seeds, null, "");
  return elements;
};

// The overlay a template turns into, previewed like its elements are.
export const presetToOverlay = (preset: OverlayPreset): PrismaOverlay => {
  const elements = seedsToElements(preset.elements, preset.id);

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    globalStyle: preset.globalStyle ?? null,
    elements,
    userId: "",
    width: preset.width ?? DEFAULT_CANVAS_WIDTH,
    height: preset.height ?? DEFAULT_CANVAS_HEIGHT,
    canvasMode: preset.canvasMode ?? CanvasModeEnum.FREE,
    revision: 0,
  };
};
