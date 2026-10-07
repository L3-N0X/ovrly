import type { PrismaOverlay, PrismaElement, BaseElementStyle } from "@/lib/types";

// Downloads the overlay (layout, styles and content) as a JSON file.
export const exportOverlay = (overlay: PrismaOverlay) => {
  type ExportElement = {
    name: string;
    type: string;
    style?: BaseElementStyle | null;
    counter?: { value: number } | null;
    title?: { text: string } | null;
    image?: { src: string } | null;
    countdown?: { mode: string; duration: number; targetAt: string | null } | null;
    twitchStat?: {
      stat: string;
      channelLogin: string;
      channelId: string | null;
      channelName: string | null;
    } | null;
    children?: ExportElement[];
  };

  const mapElement = (element: PrismaElement): ExportElement => {
    const children = overlay.elements
      .filter((e) => e.parentId === element.id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(mapElement);

    const newElement: ExportElement = {
      name: element.name,
      type: element.type as unknown as string,
      style: element.style ?? undefined,
    };

    if (element.counter) {
      newElement.counter = { value: element.counter.value };
    }
    if (element.title) {
      newElement.title = { text: element.title.text };
    }
    if (element.image) {
      newElement.image = { src: element.image.src };
    }
    // Timers are exported without their state; they start out stopped.
    if (element.countdown) {
      newElement.countdown = {
        mode: element.countdown.mode,
        duration: element.countdown.duration,
        targetAt: element.countdown.targetAt,
      };
    }
    // Which stat of which channel; the value is fetched again wherever it is imported.
    if (element.twitchStat) {
      newElement.twitchStat = {
        stat: element.twitchStat.stat,
        channelLogin: element.twitchStat.channelLogin,
        channelId: element.twitchStat.channelId,
        channelName: element.twitchStat.channelName,
      };
    }
    if (children.length > 0) {
      newElement.children = children;
    }

    return newElement;
  };

  const rootElements = overlay.elements
    .filter((element) => !element.parentId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const exportData = {
    name: overlay.name,
    // The canvas travels with the elements, so an exported overlay keeps its size and how it
    // places them.
    width: overlay.width,
    height: overlay.height,
    canvasMode: overlay.canvasMode,
    globalStyle: overlay.globalStyle,
    elements: rootElements.map(mapElement),
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${overlay.name}-ovrly-export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
