import { useEffect, useMemo, useRef } from "react";

/**
 * Debounced version of `callback` that stays the same across renders (a debounce created
 * during render starts over on every render and never actually debounces). Always calls the
 * latest `callback`, and fires a pending call on unmount instead of dropping it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useDebouncedCallback = <F extends (...args: any[]) => void>(
  callback: F,
  waitFor: number
) => {
  const callbackRef = useRef(callback);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; args: Parameters<F> } | null>(
    null
  );

  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => () => {
      if (!pending.current) return;
      clearTimeout(pending.current.timer);
      callbackRef.current(...pending.current.args);
      pending.current = null;
    },
    []
  );

  return useMemo(
    () =>
      (...args: Parameters<F>) => {
        if (pending.current) clearTimeout(pending.current.timer);
        pending.current = {
          args,
          timer: setTimeout(() => {
            pending.current = null;
            callbackRef.current(...args);
          }, waitFor),
        };
      },
    [waitFor]
  );
};
