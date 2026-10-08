import { useCallback, useState } from "react";

export interface LocalCopy<T> {
  /** The copy. Controls read this and write through `setValue`. */
  value: T;
  /** Replaces the copy, or updates it from the current one, like `useState`'s setter. */
  setValue: (next: T | ((current: T) => T)) => void;
}

/**
 * A local copy of a value the server owns.
 *
 * Editing writes to the copy, so the control stays responsive while the request is on its way
 * and the value doesn't flicker back from the server mid-edit. The copy is replaced by the
 * server's value again as soon as that changes, otherwise a change made by someone else would
 * only show up on the next local edit.
 *
 * `hold` keeps the copy for as long as it is true. Editors pass whether an interaction is in
 * progress, since adopting the server's value then would move the control out from under the
 * user; the held value is picked up once the interaction ends.
 *
 * The copy is adjusted while rendering rather than in an effect, so it is correct in the same
 * pass instead of one render later. `serverValue` has to keep its identity while it is
 * unchanged -- memoize it when it comes from a prop that may be nullish, or a fresh object
 * every render would look like a change and never settle.
 */
export const useLocalCopy = <T,>(serverValue: T, hold = false): LocalCopy<T> => {
  const [copy, setCopy] = useState(() => ({ value: serverValue, serverValue, held: hold }));

  if (copy.held !== hold || copy.serverValue !== serverValue) {
    setCopy({ value: hold ? copy.value : serverValue, serverValue, held: hold });
  }

  const setValue = useCallback<LocalCopy<T>["setValue"]>(
    (next) =>
      setCopy((current) => ({
        serverValue: current.serverValue,
        held: current.held,
        value: typeof next === "function" ? (next as (current: T) => T)(current.value) : next,
      })),
    []
  );

  return { value: copy.value, setValue };
};