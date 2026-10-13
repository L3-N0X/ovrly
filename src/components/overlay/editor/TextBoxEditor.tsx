import React from "react";
import { Scan } from "lucide-react";
import type { CounterStyle, PrismaElement, TimerStyle } from "@/lib/types";
import {
  CornerRadiusProp,
  EffectsSection,
  FieldGrid,
  FillSection,
  InspectorSection,
  Letter,
  NumberProp,
  TextSection,
} from "./fields";
import { spreadFor, useStyleDraft } from "./useStyleDraft";

/**
 * Counters, timers and countdowns: a line of text in a box that can have padding, rounded
 * corners and a fill. `textFields` come first in the Text section (the timer's format).
 */
export const TextBoxStyleEditor = <T extends CounterStyle & Pick<TimerStyle, "paddingX" | "paddingY">>({
  element,
  onChange,
  idPrefix,
  previewWord,
  separatePadding,
  textFields,
}: {
  element: PrismaElement;
  onChange: (newStyle: T) => void;
  idPrefix: string;
  previewWord: string;
  /** Padding per axis (timers) instead of one value all around (counters). */
  separatePadding?: boolean;
  textFields?: (style: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) => {
  const { style, update, colorProps } = useStyleDraft<T>(element, onChange);
  const id = `${element.id}-${idPrefix}`;
  // Older timers store one padding for both axes; each axis' own value takes precedence.
  const paddingOf = (key: "paddingX" | "paddingY") => {
    const own = style[key];
    if (typeof own === "number") return own;
    return typeof style.padding === "number" ? style.padding : 0;
  };

  return (
    <>
      <InspectorSection title="Layout">
        <FieldGrid>
          {separatePadding ? (
            <>
              <NumberProp
                id={`${id}-padding-x`}
                label="Horizontal padding"
                prefix={<Letter>X</Letter>}
                property="style.paddingX"
                min={0}
                unit="px"
                value={paddingOf("paddingX")}
                onChange={(paddingX) => update({ paddingX } as Partial<T>)}
              />
              <NumberProp
                id={`${id}-padding-y`}
                label="Vertical padding"
                prefix={<Letter>Y</Letter>}
                property="style.paddingY"
                min={0}
                unit="px"
                value={paddingOf("paddingY")}
                onChange={(paddingY) => update({ paddingY } as Partial<T>)}
              />
            </>
          ) : (
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
          )}
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
