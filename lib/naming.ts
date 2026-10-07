// Default names for things created without one, the way Figma names new layers and files:
// nobody has to come up with a name before they know what they are building.

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The number after `base` in names like "Counter 3", or 1 for `base` on its own.
const seriesNumber = (name: string, base: string) => {
  if (name === base) return 1;
  const match = name.match(new RegExp(`^${escapeRegExp(base)} (\\d+)$`));
  return match ? Number(match[1]) : null;
};

// The next name in the series `base`, `base 2`, `base 3`, ... after the highest one taken,
// so a name freed up by a deletion isn't handed out again. With `numberFirst` the series
// starts at `base 1` instead (layers count from one, files start out unnumbered).
export const nextDefaultName = (
  base: string,
  taken: Iterable<string>,
  { numberFirst = false }: { numberFirst?: boolean } = {}
) => {
  let highest = 0;
  for (const name of taken) {
    const number = seriesNumber(name, base);
    if (number !== null && number > highest) highest = number;
  }
  if (highest === 0 && !numberFirst) return base;
  return `${base} ${highest + 1}`;
};

// How new elements of each type are called before they are renamed.
export const ELEMENT_TYPE_NAMES: Record<string, string> = {
  TITLE: "Title",
  COUNTER: "Counter",
  TIMER: "Timer",
  COUNTDOWN: "Countdown",
  IMAGE: "Image",
  BINGO: "Bingo",
  CONTAINER: "Container",
  GROUP: "Group",
};

// What an overlay started from an empty canvas is called.
export const UNTITLED_OVERLAY_NAME = "Untitled";
