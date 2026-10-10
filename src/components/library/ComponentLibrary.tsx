import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Blocks,
  Download,
  FileUp,
  Info,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  COMPONENTS_QUERY_KEY,
  countComponentElements,
  deleteComponent,
  droppedImagesMessage,
  exportComponent,
  fetchComponents,
  importComponentFile,
  updateComponent,
  type OverlayComponent,
} from "@/lib/components";
import { focusSearchOnType } from "@/lib/typeToSearch";
import { cn, timeAgo } from "@/lib/utils";
import { ComponentDetailsForm } from "./ComponentDetailsForm";
import ComponentPreview from "./ComponentPreview";

// The "Components" tab of the home page: the user's components, which they rename, export as
// files to share, delete, and import files of others into. They are added to overlays from the
// editor's "Add element" dialog.
export const ComponentLibrary: React.FC = () => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: COMPONENTS_QUERY_KEY, queryFn: fetchComponents });
  const components = useMemo(() => query.data ?? [], [query.data]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "info"; message: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [editTarget, setEditTarget] = useState<OverlayComponent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OverlayComponent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Kept while the dialogs animate out, after their target has been cleared.
  const [shownEditTarget, setShownEditTarget] = useState(editTarget);
  if (editTarget && editTarget !== shownEditTarget) setShownEditTarget(editTarget);
  const [shownDeleteTarget, setShownDeleteTarget] = useState(deleteTarget);
  if (deleteTarget && deleteTarget !== shownDeleteTarget) setShownDeleteTarget(deleteTarget);

  const searchRef = useRef<HTMLInputElement>(null);
  // Typing anywhere on the page searches, unless a dialog or menu is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("[role='dialog'], [role='menu']"))
        return;
      focusSearchOnType(e, searchRef.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const setComponents = (update: (current: OverlayComponent[]) => OverlayComponent[]) =>
    queryClient.setQueryData<OverlayComponent[]>(COMPONENTS_QUERY_KEY, (current) =>
      update(current ?? [])
    );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return components.filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
    );
  }, [components, search]);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setNotice(null);
    try {
      const component = await importComponentFile(file);
      setComponents((current) => [component, ...current]);
      const dropped = droppedImagesMessage(component.droppedImages);
      setNotice(
        dropped
          ? { tone: "info", message: dropped }
          : { tone: "info", message: `“${component.name}” was added to your components.` }
      );
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The file couldn't be imported.",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteComponent(deleteTarget.id);
      setComponents((current) => current.filter((c) => c.id !== deleteTarget.id));
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "The component couldn't be deleted.",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
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
      <Button variant="outline" disabled={importing} onClick={() => fileInput.current?.click()}>
        {importing ? <Loader2 className="animate-spin" /> : <FileUp />}
        Import component
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Elements you saved to reuse. Add them to any overlay from “Add element”, or export them
          as files to share.
        </p>
        <div className="flex items-center gap-2">
          {components.length > 0 && (
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search components…"
                className="pr-8 pl-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
          {importButton}
        </div>
      </div>

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm",
            notice.tone === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "bg-muted/50 text-muted-foreground"
          )}
        >
          {notice.tone === "error" ? (
            <AlertCircle className="size-4 shrink-0" />
          ) : (
            <Info className="size-4 shrink-0" />
          )}
          <span className="flex-1">{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 opacity-70 hover:opacity-100"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {query.isPending ? (
        <ComponentGrid>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-card">
              <div className="aspect-video animate-pulse bg-muted" />
              <div className="space-y-3 border-t p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </ComponentGrid>
      ) : query.isError ? (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">Failed to load your components: {query.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : components.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-dashed px-6 py-20 text-center">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Blocks className="size-8" />
            </span>
            <h2 className="text-xl font-semibold">No components yet</h2>
            <p className="text-muted-foreground">
              Built something you want to use again? In the editor, right-click it in the layers
              panel and choose “Save as component”. Got a component file from someone? Import it
              here.
            </p>
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="font-medium">No components match “{search.trim()}”</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setSearch("")}>
            Clear search
          </Button>
        </div>
      ) : (
        <ComponentGrid>
          {visible.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
            />
          ))}
        </ComponentGrid>
      )}

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Component details</DialogTitle>
            <DialogDescription>Shown in your components and in the files you export.</DialogDescription>
          </DialogHeader>
          {shownEditTarget && (
            <ComponentDetailsForm
              key={shownEditTarget.id}
              initial={shownEditTarget}
              submitLabel="Save"
              onCancel={() => setEditTarget(null)}
              onSubmit={async (details) => {
                const updated = await updateComponent(shownEditTarget.id, details);
                setComponents((current) => current.map((c) => (c.id === updated.id ? updated : c)));
                setEditTarget(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        title={<>Delete “{shownDeleteTarget?.name}”?</>}
        description="It's removed from your components. Overlays it was added to keep their copy of it, and files you exported still work."
        confirmLabel="Delete"
        icon={<Trash2 />}
        destructive
        busy={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
};

const ComponentGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {children}
  </div>
);

const ComponentCard: React.FC<{
  component: OverlayComponent;
  onEdit: (component: OverlayComponent) => void;
  onDelete: (component: OverlayComponent) => void;
}> = ({ component, onEdit, onDelete }) => {
  const count = countComponentElements(component.elements);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-within:border-primary/40">
      <div className="relative">
        <ComponentPreview component={component} className="aspect-video w-full" />
        <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white/90 backdrop-blur">
          <Layers className="size-3" />
          {count} {count === 1 ? "element" : "elements"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 border-t p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{component.name}</h3>
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {component.description || "No description"}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Export as file"
              aria-label="Export as file"
              onClick={() => exportComponent(component)}
            >
              <Download />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onEdit(component)}>
                  <Pencil />
                  Edit details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportComponent(component)}>
                  <Download />
                  Export file
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(component)}>
                  <Trash2 />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <time
          dateTime={component.createdAt}
          title={`Saved ${new Date(component.createdAt).toLocaleString()}`}
          className="mt-auto text-xs text-muted-foreground"
        >
          Saved {timeAgo(component.createdAt)}
        </time>
      </div>
    </article>
  );
};
