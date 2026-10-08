import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  /** Tooltip and accessible name; also the text when there is no icon. */
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Picks one of a few options. The selected one is a raised segment with a tinted icon, hover
 * only brightens the text, so the two never look alike. Only as wide as its options.
 */
function SegmentedControl<T extends string>({
  id,
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ToggleGroupPrimitive.Root
      id={id}
      type="single"
      value={value}
      // Clicking the selected segment would deselect it; a segmented control always has one.
      onValueChange={(next) => next && onValueChange(next as T)}
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-0.5 rounded-lg border border-input bg-muted/50 p-0.5 dark:bg-input/25",
        className
      )}
    >
      {options.map(({ value: optionValue, label, icon: Icon }) => (
        <ToggleGroupPrimitive.Item
          key={optionValue}
          value={optionValue}
          title={label}
          aria-label={label}
          className={cn(
            "inline-flex h-7 cursor-pointer items-center justify-center rounded-md text-sm font-medium whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] outline-none",
            "data-[state=off]:hover:bg-foreground/5 data-[state=off]:hover:text-foreground",
            "focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "data-[state=on]:bg-popover data-[state=on]:text-primary data-[state=on]:shadow-sm data-[state=on]:ring-1 data-[state=on]:ring-black/5",
            "dark:data-[state=on]:bg-input dark:data-[state=on]:text-ring dark:data-[state=on]:ring-white/10",
            "disabled:pointer-events-none disabled:opacity-50",
            Icon ? "w-8" : "px-3"
          )}
        >
          {Icon ? <Icon className="size-4" /> : label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export { SegmentedControl };
