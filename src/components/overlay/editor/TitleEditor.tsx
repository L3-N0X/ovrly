import React from "react";
import type { BaseElementStyle, PrismaElement } from "@/lib/types";
import { EffectsSection, TextSection } from "./fields";
import { useStyleDraft } from "./useStyleDraft";

export const TitleStyleEditor: React.FC<{
  element: PrismaElement;
  onChange: (newStyle: BaseElementStyle) => void;
}> = ({ element, onChange }) => {
  const { style, update, colorProps } = useStyleDraft(element, onChange);
  const id = `${element.id}-title`;

  return (
    <>
      <TextSection
        id={id}
        style={style}
        defaultFontSize={36}
        previewWord={element.title?.text}
        colorProps={colorProps}
        onChange={update}
      />
      <EffectsSection id={id} style={style} colorProps={colorProps} onChange={update} />
    </>
  );
};
