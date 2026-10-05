import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";
import { GlobalStyleEditor } from "./GlobalStyleEditor";
import { ElementListEditor, type ElementListEditorProps } from "./elementlist/ElementListEditor";

type StyleEditorProps = ElementListEditorProps;

const StyleEditor: React.FC<StyleEditorProps> = (props) => {
  const { overlay, onOverlayChange } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Customize the look and feel of your overlay.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <GlobalStyleEditor overlay={overlay} onOverlayChange={onOverlayChange} />
        <hr />
        <ElementListEditor {...props} />
      </CardContent>
    </Card>
  );
};

export default StyleEditor;
