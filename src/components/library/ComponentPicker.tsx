import React, { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPONENTS_QUERY_KEY,
  countComponentElements,
  droppedImagesMessage,
  fetchComponents,
  importComponentFile,
  type OverlayComponent,
} from "@/lib/components";
import { GRID_ITEM_ATTRIBUTE } from "@/lib/gridNavigation";
import type { OverlayVariable } from "@/lib/types";
import { cn } from "@/lib/utils";
import ComponentPreview from "./ComponentPreview";

export interface Notice {
  tone: "error" | "info";
  message: string;
}

// The "My components" tab of the add element dialog: the user's components, one click adds a
// copy. Files can be imported right here too.
export const ComponentPicker: React.FC<{
  // The overlay's variables, so previews show what the component will show there.
  variables?: OverlayVariable[];
  // The component being added, while its request is on the way.
  adding: string | null;
  disabled: boolean;
  onPick: (component: OverlayComponent) => void;
  onNotice: (notice: Notice | null) => void;
}> = ({ variables, adding, disabled, onPick, onNotice }) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: COMPONENTS_QUERY_KEY, queryFn: fetchComponents });
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    onNotice(null);
    try {
      const component = await importComponentFile(file);
      queryClient.setQueryData<OverlayComponent[]>(COMPONENTS_QUERY_KEY, (current) => [
        component,
        ...(current ?? []),
      ]);
      const dropped = droppedImagesMessage(component.droppedImages);
      onNotice(dropped ? { tone: "info", message: dropped } : null);
    } catch (error) {
      onNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The file couldn't be imported.",
      });
    } finally {
      setImporting(false);
    }
  };

  const importButton = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          void handleImport(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={importing}
        onClick={() => fileInput.current?.click()}
      >
        {importing ? <Loader2 className="animate-spin" /> : <FileUp />}
        Import file
      </Button>
    </>
  );

  if (query.isPending) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
        <p>{query.error.message}</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const components = query.data;
  if (components.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Blocks className="size-6" />
        </span>
        <div>
          <p className="font-medium">No components yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Right-click an element in the layers panel and choose “Save as component” to reuse it
            in any overlay, or import a component file someone shared with you.
          </p>
        </div>
        {importButton}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          My components
        </h3>
        {importButton}
      </div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3">
        {components.map((component, index) => {
          const isAdding = adding === component.id;
          const count = countComponentElements(component.elements);
          return (
            <button
              key={component.id}
              type="button"
              {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
              autoFocus={index === 0}
              onClick={() => onPick(component)}
              aria-disabled={disabled}
              className={cn(
                "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all outline-none",
                "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
                disabled ? "cursor-default" : "cursor-pointer hover:border-primary/50 hover:shadow-md",
                disabled && !isAdding && "opacity-50"
              )}
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden border-b">
                <ComponentPreview
                  component={component}
                  variables={variables}
                  className="h-full w-full"
                />
                {isAdding && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-6 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Blocks className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{component.name}</span>
                </div>
                <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                  {component.description ||
                    `${count} ${count === 1 ? "element" : "elements"}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
