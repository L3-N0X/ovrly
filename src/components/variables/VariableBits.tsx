import React from "react";
import { Hash, Image, Palette, ToggleLeft, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatVariableValue } from "@/lib/variables";
import type { VariableType, VariableValue } from "@/lib/types";

const TYPE_ICONS: Record<VariableType, React.ComponentType<{ className?: string }>> = {
  STRING: Type,
  INTEGER: Hash,
  DOUBLE: Hash,
  BOOLEAN: ToggleLeft,
  COLOR: Palette,
  IMAGE: Image,
};

export const VariableTypeIcon: React.FC<{ type: VariableType; className?: string }> = ({
  type,
  className,
}) => {
  const Icon = TYPE_ICONS[type];
  return <Icon className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
};

// A variable's value in a line of text: a swatch for colours, a thumbnail for images. `compact`
// leaves out the hex code next to a swatch, for narrow places.
export const VariableValuePreview: React.FC<{
  type: VariableType;
  value: VariableValue;
  compact?: boolean;
  className?: string;
}> = ({ type, value, compact, className }) => {
  if (type === "COLOR") {
    return (
      <span
        className={cn("flex min-w-0 items-center gap-1.5", className)}
        title={compact ? String(value) : undefined}
      >
        <span
          className="size-3.5 shrink-0 rounded-sm border border-black/10 dark:border-white/15"
          style={{ backgroundColor: String(value) }}
        />
        {!compact && <span className="truncate font-mono text-xs">{String(value)}</span>}
      </span>
    );
  }
  if (type === "IMAGE") {
    return value ? (
      <img
        src={String(value)}
        alt=""
        className={cn("size-5 shrink-0 rounded-sm bg-secondary object-cover", className)}
      />
    ) : (
      <span className={cn("text-xs text-muted-foreground", className)}>No image</span>
    );
  }
  const text = formatVariableValue(type, value);
  return (
    <span className={cn("truncate text-xs tabular-nums", !text && "text-muted-foreground", className)}>
      {text || "Empty"}
    </span>
  );
};
