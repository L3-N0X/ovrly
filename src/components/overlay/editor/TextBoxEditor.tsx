import React from "react";
import { Scan } from "lucide-react";
import type { CounterStyle, PrismaElement } from "@/lib/types";
import {
  CornerRadiusProp,
  EffectsSection,
  FieldGrid,
  FillSection,
  InspectorSection,
  NumberProp,
  TextSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

/**
 * Counters, timers and countdowns: a line of text in a box that can have padding, rounded
 * corners and a fill. `textFields` come first in the Text section (the timer's format).
 */
export const TextBoxStyleEditor = <T extends CounterStyle>({
  element,
  onChange,
  idPrefix,
  previewWord,
  textFields,
}: {
  element: PrismaElement;
  onChange: (newStyle: T) => void;
  idPrefix: string;
  previewWord: string;
  textFields?: (style: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) => {
  const { style, update, colorProps } = useStyleDraft<T>(element, onChange);
  const id = `${element.id}-${idPrefix}`;

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          <NumberProp
            id={`${id}-padding`}
            label="Padding"
            prefix={<Scan />}
            property="style.padding"
            min={0}
            unit="px"
            value={typeof style.padding === "number" ? style.padding : 0}
            onChange={(padding) => update({ padding } as Partial<T>)}
          />
        </FieldGrid>
      </InspectorSection>
      <InspectorSection title="Appearance">
        <FieldGrid>
          <CornerRadiusProp
            id={`${id}-radius`}
            property="radius"
            value={typeof style.radius === "number" ? style.radius : 0}
            onChange={(radius) => update({ radius } as Partial<T>)}
          />
        </FieldGrid>
      </InspectorSection>
      <TextSection
        id={id}
        style={style}
        defaultFontSize={128}
        previewWord={previewWord}
        colorProps={colorProps}
        onChange={(patch) => update(patch as Partial<T>)}
      >
        {textFields?.(style, update)}
      </TextSection>
      <FillSection
        id={id}
        value={style.backgroundColor}
        defaultColor="#333333"
        colorProps={colorProps}
        onChange={(backgroundColor) => update({ backgroundColor } as Partial<T>)}
      />
      <EffectsSection
        id={id}
        style={style}
        spread={spreadFor(style.backgroundColor)}
        colorProps={colorProps}
        onChange={(patch) => update(patch as Partial<T>)}
      />
    </>
  );
};
