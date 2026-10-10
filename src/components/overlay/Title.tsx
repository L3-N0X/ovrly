import React from "react";
import type { TitleStyle } from "@/lib/types";
import { textStyle } from "./textStyle";

interface TitleProps {
  text: string;
  style: TitleStyle;
}

const Title: React.FC<TitleProps> = ({ text, style }) => (
  <h1
    style={{
      ...textStyle(style, 36),
      // Keep an empty title's line box so bound text can disappear without changing the layout.
      // `1em` follows the selected font size while remaining independent of the font's glyphs.
      minHeight: "1em",
      paddingLeft: typeof style.paddingX === "number" ? `${style.paddingX}px` : undefined,
      paddingRight: typeof style.paddingX === "number" ? `${style.paddingX}px` : undefined,
      paddingTop: typeof style.paddingY === "number" ? `${style.paddingY}px` : undefined,
      paddingBottom: typeof style.paddingY === "number" ? `${style.paddingY}px` : undefined,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </h1>
);

export default Title;
