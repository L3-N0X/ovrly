import { normalizeBingoData } from "./bingo";
import {
  CanvasModeEnum,
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  type CanvasMode,
  type ElementStyle,
  type ElementType,
  type GlobalStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "./types";

// An element of a template, nested the way it is stored in overlay-presets.json.
export interface PresetElement {
  name: string;
  type: ElementType;
  style?: ElementStyle;
  title?: { text: string };
  counter?: { value: number };
  timer?: { duration?: number | null; countDown?: boolean };
  image?: { src: string };
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

export const fetchPresets = async (): Promise<OverlayPreset[]> => {
  const response = await fetch("/presets/overlay-presets.json");
  if (!response.ok) throw new Error("Failed to fetch presets");
  const data = await response.json();
  return data.presets;
};

// The overlay a template turns into, so it can be previewed with the real renderer before
// it is created. The ids are made up; nothing here is ever saved.
export const presetToOverlay = (preset: OverlayPreset): PrismaOverlay => {
  const elements: PrismaElement[] = [];
  const add = (seeds: PresetElement[], parentId: string | null, path: string) =>
    seeds.forEach((seed, position) => {
      const id = `${preset.id}/${path}${position}`;
      elements.push({
        id,
        name: seed.name,
        type: seed.type,
        position,
        parentId,
        style: seed.style ?? {},
        title: seed.title ? { id, ...seed.title } : null,
        counter: seed.counter ? { id, ...seed.counter } : null,
        timer: seed.timer
          ? {
              id,
              startedAt: null,
              pausedAt: null,
              duration: seed.timer.duration ?? null,
              countDown: seed.timer.countDown ?? false,
            }
          : null,
        image: seed.image ? { id, ...seed.image } : null,
        bingo: seed.bingo
          ? { id, ...normalizeBingoData(seed.bingo as PrismaElement["bingo"]) }
          : null,
      });
      if (seed.children) add(seed.children, id, `${path}${position}/`);
    });
  add(preset.elements, null, "");

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
