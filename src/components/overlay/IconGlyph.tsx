import React from "react";
import { resolveIcon, useIconSet, type IconSet } from "@/lib/icons";
import type { IconLibrary } from "@/lib/types";

interface IconSvgProps {
  set: IconSet;
  name: string;
  size: number;
  color?: string;
  label?: string;
  className?: string;
}

// An icon of a library that has already loaded, drawn in `color` (the text color by default).
// Used where many icons are shown at once, so they share one subscription to the library.
export const IconSvg: React.FC<IconSvgProps> = ({ set, name, size, color, label, className }) => {
  const icon = resolveIcon(set, name);
  if (!icon) {
    // The library no longer has this icon: an outline keeps its place and size.
    return (
      <span
        className={className}
        title={label}
        style={{
          display: "block",
          width: size,
          height: size,
          flexShrink: 0,
          border: "2px dashed currentColor",
          opacity: 0.4,
          color,
        }}
      />
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={icon.viewBox}
      width={size}
      height={size}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{ display: "block", flexShrink: 0, color }}
      // The markup is the library's own, looked up by name in the set bundled with the app.
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
};

interface IconGlyphProps {
  library: IconLibrary;
  name: string;
  size: number;
  color?: string;
  label?: string;
  className?: string;
}

// An icon by library and name, loading the library first if needed. Until it is there an empty
// box of the same size is shown, so nothing around it moves when the icon appears.
const IconGlyph: React.FC<IconGlyphProps> = ({ library, ...props }) => {
  const set = useIconSet(library);
  if (!set) {
    return (
      <span
        className={props.className}
        style={{ display: "block", width: props.size, height: props.size, flexShrink: 0 }}
      />
    );
  }
  return <IconSvg set={set} {...props} />;
};

export default IconGlyph;
