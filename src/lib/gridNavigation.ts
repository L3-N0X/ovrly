import type React from "react";

// Marks the cards a grid's arrow keys move between.
export const GRID_ITEM_ATTRIBUTE = "data-grid-item";

const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

// Moves focus between the cards of a grid of choices with the arrow keys, Home and End, the
// way it works in a file picker. Tab still moves through them one by one. Up and down go to
// the nearest card in the row above or below, so it works for any number of columns, and
// across several grids inside the same container.
export const handleGridKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>(`[${GRID_ITEM_ATTRIBUTE}]:not(:disabled)`)
  );
  const current = items.findIndex((item) => item === document.activeElement);
  if (current === -1) return;

  let next: HTMLElement | undefined;
  switch (e.key) {
    case "ArrowRight":
      next = items[current + 1];
      break;
    case "ArrowLeft":
      next = items[current - 1];
      break;
    case "Home":
      next = items[0];
      break;
    case "End":
      next = items[items.length - 1];
      break;
    case "ArrowDown":
    case "ArrowUp": {
      const from = center(items[current].getBoundingClientRect());
      const down = e.key === "ArrowDown";
      let best = Infinity;
      for (const item of items) {
        const to = center(item.getBoundingClientRect());
        const dy = down ? to.y - from.y : from.y - to.y;
        // Only cards in another row, in the right direction.
        if (dy <= 1) continue;
        // Rows count first, then how far off to the side it is.
        const score = dy * 4 + Math.abs(to.x - from.x);
        if (score < best) {
          best = score;
          next = item;
        }
      }
      break;
    }
    default:
      return;
  }
  e.preventDefault();
  next?.focus();
  next?.scrollIntoView({ block: "nearest" });
};
