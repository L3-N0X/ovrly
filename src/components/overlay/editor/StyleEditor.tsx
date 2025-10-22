import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type PrismaOverlay } from "@/lib/types";
import React from "react";
import { GlobalStyleEditor } from "./GlobalStyleEditor";
import { ElementListEditor } from "./elementlist/ElementListEditor";

interface StyleEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
  ws: WebSocket | null;
}

const StyleEditor: React.FC<StyleEditorProps> = ({ overlay, onOverlayChange, ws }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the look and feel of your overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <GlobalStyleEditor overlay={overlay} onOverlayChange={onOverlayChange} />
        <hr />
        <ElementListEditor overlay={overlay} onOverlayChange={onOverlayChange} ws={ws} />
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
