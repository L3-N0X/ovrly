import React from "react";
import type { IconStyle, PrismaElement } from "@/lib/types";
import IconGlyph from "./IconGlyph";

interface IconProps {
  icon: NonNullable<PrismaElement["icon"]>;
  style: IconStyle;
  label: string;
}

// A square icon of one of the icon libraries, drawn at the style's size in its color.
const Icon: React.FC<IconProps> = ({ icon, style, label }) => (
  <IconGlyph
    library={icon.library}
    name={icon.name}
    size={typeof style?.size === "number" ? style.size : 64}
    color={style?.color || "#ffffff"}
    label={label}
  />
);

export default Icon;
