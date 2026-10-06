// Helpers shared by the free-placed element wrapper and the group that contains it.

// Holding Shift snaps to a 10px grid.
export const snap = (value: number, shiftKey: boolean) =>
  shiftKey ? Math.round(value / 10) * 10 : Math.round(value);

// The canvas is scaled to fit the editor viewport, so pointer movement on screen has to be
// converted back into canvas pixels.
export const canvasScale = (el: HTMLElement) =>
  el.getBoundingClientRect().width / el.offsetWidth || 1;