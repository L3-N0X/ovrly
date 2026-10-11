import React from "react";
import type { CounterStyle, PrismaElement } from "@/lib/types";
import { TextBoxStyleEditor } from "./TextBoxEditor";

export const CounterStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: CounterStyle) => void;
}> = ({ element, onChange }) => (
  <TextBoxStyleEditor
    element={element}
    onChange={onChange}
    idPrefix="counter"
    previewWord="1234567890"
  />
);
