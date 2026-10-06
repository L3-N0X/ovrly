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
    timer?: { duration: number | null; countDown: boolean } | null;
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
    if (element.timer) {
      newElement.timer = {
        duration: element.timer.duration,
        countDown: element.timer.countDown,
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
