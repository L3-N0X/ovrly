import React from "react";
import type { IconStyle, PrismaElement } from "@/lib/types";
import IconGlyph from "./IconGlyph";
import { shadowStyle } from "./shadow";

interface IconProps {
  icon: NonNullable<PrismaElement["icon"]>;
  style: IconStyle;
  label: string;
}

// A square icon of one of the icon libraries, drawn at the style's size in its color.
const Icon: React.FC<IconProps> = ({ icon, style, label }) => {
  const glyph = (
    <IconGlyph
      library={icon.library}
      name={icon.name}
      size={typeof style?.size === "number" ? style.size : 64}
      color={style?.color || "#ffffff"}
      label={label}
    />
  );
  // The shadow follows the drawing, so it needs a box around the svg to be applied to.
  return style?.shadowColor ? (
    <div style={{ display: "block", flexShrink: 0, ...shadowStyle(style) }}>{glyph}</div>
  ) : (
    glyph
  );
};

export default Icon;
