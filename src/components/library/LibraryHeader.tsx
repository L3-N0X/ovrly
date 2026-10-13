import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// The row under the home page header: the Overlays/Components tabs on the left and the tools of
// the open tab (search, sort, import, ...) on the right, above one shared divider. On narrow
// screens the tools move above the tabs.
export const LibraryHeader: React.FC<{ tabs: React.ReactNode; children?: React.ReactNode }> = ({
  tabs,
  children,
}) => (
  <div className="flex flex-col-reverse gap-3 border-b lg:flex-row lg:items-end lg:justify-between">
    {tabs}
    {children && <div className="flex items-center gap-2 lg:pb-2">{children}</div>}
  </div>
);

export const SearchField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  ref?: React.Ref<HTMLInputElement>;
}> = ({ value, onChange, placeholder, className, ref }) => (
  <div className={cn("relative flex-1 lg:w-72 lg:flex-none", className)}>
    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pr-8 pl-9"
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange("")}
        aria-label="Clear search"
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    )}
  </div>
);
