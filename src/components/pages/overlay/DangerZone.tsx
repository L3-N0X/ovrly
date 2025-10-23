import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PrismaOverlay, PrismaElement, BaseElementStyle } from "@/lib/types";

interface DangerZoneProps {
  handleDeleteOverlay: () => void;
  overlay: PrismaOverlay | null;
}

const DangerZone: React.FC<DangerZoneProps> = ({ handleDeleteOverlay, overlay }) => {
  const handleExport = () => {
    if (!overlay) return;

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>This action is irreversible. Please be certain.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button onClick={handleExport} variant="outline" className="w-full">
          Export to JSON
        </Button>
        <Button onClick={handleDeleteOverlay} variant="destructive" className="w-full">
          Delete Overlay
        </Button>
      </CardContent>
    </Card>
  );
};

export default DangerZone;
