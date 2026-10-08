import { cn } from "@/lib/utils";

export interface PanelTab<T extends string> {
  value: T;
  label: string;
}

// The tabs at the top of the right hand panel ("Editor", "Variables"), like Figma's
// Design/Prototype tabs.
export function PanelTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  label,
}: {
  tabs: readonly PanelTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex h-11 shrink-0 items-center gap-1 border-b bg-background px-2"
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onValueChange(tab.value)}
          className={cn(
            "h-7 cursor-pointer rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tab.value === value
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
