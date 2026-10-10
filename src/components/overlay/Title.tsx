import React from "react";
import { ElementTypeEnum, type TitleStyle } from "@/lib/types";
import { textStyle } from "./textStyle";
import { useFill } from "./fill";

interface TitleProps {
  text: string;
  style: TitleStyle;
}

const VERTICAL_ALIGN = { top: "flex-start", center: "center", bottom: "flex-end" } as const;

const Title: React.FC<TitleProps> = ({ text, style }) => {
  const fill = useFill({ type: ElementTypeEnum.TITLE, style });
  return (
    <h1
      style={{
        ...textStyle(style, 36),
        // The font's own ascent and descent (Figma's "Auto"): most fonts draw past a 1em line box,
        // so with `lineHeight: 1` descenders like "g" and "y" hang out of the title and get clipped.
        lineHeight: "normal",
        // A column, so the text can sit at the top, centre or bottom of a title taller than it
        // (one that fills its parent's height). Across, the text block spans the title and
        // `textAlign` places the text in it.
        display: "flex",
        flexDirection: "column",
        justifyContent: VERTICAL_ALIGN[style.verticalAlign ?? "top"] ?? "flex-start",
        textAlign: style.textAlign ?? "left",
        paddingLeft: typeof style.paddingX === "number" ? `${style.paddingX}px` : undefined,
        paddingRight: typeof style.paddingX === "number" ? `${style.paddingX}px` : undefined,
        paddingTop: typeof style.paddingY === "number" ? `${style.paddingY}px` : undefined,
        paddingBottom: typeof style.paddingY === "number" ? `${style.paddingY}px` : undefined,
        whiteSpace: "nowrap",
        boxSizing: "border-box",
        ...fill.style,
      }}
    >
      {/* A zero-width space keeps an empty title's line box, so bound text can disappear
          without changing the layout. */}
      {text || "​"}
    </h1>
  );
};

export default Title;
