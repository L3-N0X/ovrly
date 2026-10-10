import { useMemo, useState } from "react";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import type { ElementStyle, PrismaElement } from "@/lib/types";

/**
 * The style an editor works on: a local copy of the element's, updated on every change so the
 * canvas follows right away (saving is debounced by the overlay itself). It is held while a
 * colour picker is open (`colorProps`), which would otherwise snap the swatch back mid-drag.
 */
export const useStyleDraft = <T extends ElementStyle>(
  element: PrismaElement,
  onChange: (style: T) => void,
  resolve?: (style: T | null) => T
) => {
  const [isPickingColor, setIsPickingColor] = useState(false);
  // Memoized so the identity only changes when the element's style does: `useLocalCopy` takes a
  // new value to mean the server sent a new one.
  const serverStyle = useMemo(
    () => (resolve ? resolve(element.style as T | null) : ((element.style || {}) as T)),
    // `resolve` is a module level function wherever it is passed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element.style]
  );
  const { value: style, setValue: setStyle } = useLocalCopy(serverStyle, isPickingColor);
  // Keys set to undefined are removed (and sent as null), which is how optional parts go away.
  const update = (patch: Partial<T>) => {
    const updated = { ...style, ...patch };
    setStyle(updated);
    onChange(updated);
  };
  return { style, update, colorProps: { onOpenChange: setIsPickingColor } };
};

/** Spread is offered to elements that can have a fill; it applies while they have one. */
export const spreadFor = (fill: string | undefined): "available" | "needs-fill" =>
  fill ? "available" : "needs-fill";
