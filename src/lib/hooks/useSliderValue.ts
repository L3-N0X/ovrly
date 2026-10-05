import { useState, useEffect, useRef } from "react";

interface SliderValueOptions {
  onCommit?: (value: number) => void;
}

/**
 * Local state for a slider: dragging stays responsive without touching the server, the
 * value follows `initialValue` while the user isn't dragging, and `onCommit` fires once
 * when the interaction ends.
 */
export const useSliderValue = (initialValue: number, options: SliderValueOptions = {}) => {
  const { onCommit } = options;

  const [uiValue, setUiValue] = useState(initialValue);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) {
      setUiValue(initialValue);
    }
  }, [initialValue]);

  const handleInteractionEnd = () => {
    isDragging.current = false;
    onCommit?.(uiValue);
  };

  return {
    value: uiValue,
    onChange: setUiValue,
    onInteractionStart: () => {
      isDragging.current = true;
    },
    onInteractionEnd: handleInteractionEnd,
  };
};
