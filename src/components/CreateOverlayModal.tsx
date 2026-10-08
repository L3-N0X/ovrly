import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Loader2, Plus } from "lucide-react";
import OverlayPreview from "@/components/home/OverlayPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GRID_ITEM_ATTRIBUTE, handleGridKeyDown } from "@/lib/gridNavigation";
import { fetchPresets, presetToOverlay, type OverlayPreset } from "@/lib/presets";
import { DEFAULT_CANVAS_HEIGHT, DEFAULT_CANVAS_WIDTH, type PrismaOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CreateOverlayModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// What is being created: an empty canvas, or the template with this id.
const EMPTY_CANVAS = "empty";

// Starts a new overlay from an empty canvas or a template. One click creates it and opens
// the editor; it gets a default name ("Untitled", "Timer 2", ...) that can be changed there
// once it's clear what it is.
const CreateOverlayModal: React.FC<CreateOverlayModalProps> = ({ open, onOpenChange }) => {
  // Closing is held off while an overlay is being created, so it isn't created out of sight.
  const [isCreating, setIsCreating] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => (next || !isCreating) && onOpenChange(next)}>
      <DialogContent className="flex max-h-[min(90dvh,880px)] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>New overlay</DialogTitle>
          <DialogDescription>
            Start from scratch or from a template. You can rename it anytime in the editor.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog, so every opening starts fresh. */}
        <Choices onCreatingChange={setIsCreating} />
      </DialogContent>
    </Dialog>
  );
};

const Choices = ({ onCreatingChange }: { onCreatingChange: (creating: boolean) => void }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const presetsQuery = useQuery({
    queryKey: ["overlay-presets"],
    queryFn: fetchPresets,
    staleTime: Infinity,
  });
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (choice: string) => {
    if (creating) return;
    setCreating(choice);
    onCreatingChange(true);
    setError(null);
    try {
      const response = await fetch("/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(choice === EMPTY_CANVAS ? {} : { presetId: choice }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Failed to create the overlay (${response.status})`);
      }
      const overlay: PrismaOverlay = await response.json();
      void queryClient.invalidateQueries({ queryKey: ["overlays"] });
      onCreatingChange(false);
      navigate(`/overlay/${overlay.id}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "The overlay couldn't be created.");
      setCreating(null);
      onCreatingChange(false);
    }
  };

  return (
    <>
      <div
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5"
        onKeyDown={handleGridKeyDown}
      >
        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="button"
          {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
          // The usual start, so it has focus first and Enter creates it.
          autoFocus
          onClick={() => create(EMPTY_CANVAS)}
          aria-disabled={!!creating}
          className={cn(
            "group flex w-full items-center gap-4 rounded-xl border bg-card p-3 text-left transition-all outline-none",
            "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
            creating ? "cursor-default" : "cursor-pointer hover:border-primary/50 hover:shadow-md",
            creating && creating !== EMPTY_CANVAS && "opacity-50"
          )}
        >
          <span className="flex aspect-video w-32 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground transition-colors group-hover:border-primary/50 group-hover:text-primary">
            {creating === EMPTY_CANVAS ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <Plus className="size-6" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Empty canvas</span>
            <span className="block text-sm text-muted-foreground">
              {DEFAULT_CANVAS_WIDTH} × {DEFAULT_CANVAS_HEIGHT}, nothing on it yet. Add elements
              and place them anywhere.
            </span>
          </span>
          <ArrowRight className="mr-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        </button>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Templates
          </h3>
          {presetsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              The templates couldn't be loaded.
              <Button variant="outline" size="sm" onClick={() => presetsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {presetsQuery.data
                ? presetsQuery.data.map((preset) => (
                    <TemplateCard
                      key={preset.id}
                      preset={preset}
                      isCreating={creating === preset.id}
                      isDisabled={!!creating}
                      onCreate={() => create(preset.id)}
                    />
                  ))
                : Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="overflow-hidden rounded-xl border">
                      <div className="aspect-video animate-pulse bg-muted" />
                      <div className="space-y-2 p-3">
                        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
            </div>
          )}
        </section>
      </div>
      <p className="hidden border-t bg-muted/30 px-6 py-2.5 text-xs text-muted-foreground sm:block">
        Arrow keys to move between choices · Enter to create · Esc to close
      </p>
    </>
  );
};

const TemplateCard = ({
  preset,
  isCreating,
  isDisabled,
  onCreate,
}: {
  preset: OverlayPreset;
  isCreating: boolean;
  isDisabled: boolean;
  onCreate: () => void;
}) => {
  // Previewed with the real renderer, so it looks exactly like what gets created.
  const overlay = useMemo(() => presetToOverlay(preset), [preset]);
  return (
    <button
      type="button"
      {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
      onClick={onCreate}
      aria-disabled={isDisabled}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all outline-none",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
        isDisabled ? "cursor-default" : "cursor-pointer hover:border-primary/50 hover:shadow-md",
        isDisabled && !isCreating && "opacity-50"
      )}
    >
      <div className="relative w-full border-b">
        <OverlayPreview overlay={overlay} />
        {isCreating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="text-sm font-medium">{preset.name}</div>
        <p className="text-xs leading-snug text-muted-foreground">{preset.description}</p>
      </div>
    </button>
  );
};

export default CreateOverlayModal;
