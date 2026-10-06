import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import type { OverlaySummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Layers,
  Loader2,
  MonitorPlay,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import OverlayCard from "@/components/OverlayCard";
import CreateOverlayModal from "@/components/CreateOverlayModal";
import { ShareOverlayModal } from "@/components/pages/overlay/ShareOverlayModal";

interface Element {
  id: string;
  name: string;
  type: string;
  style?: Record<string, unknown>;
}

interface OverlayPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  elements: Element[];
}

type Filter = "all" | "mine" | "shared";
type Sort = "newest" | "oldest" | "name";

const SORT_STORAGE_KEY = "ovrly-home-sort";
const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name: "Name (A–Z)",
};

const readStoredSort = (): Sort => {
  const stored = localStorage.getItem(SORT_STORAGE_KEY);
  return stored && stored in SORT_LABELS ? (stored as Sort) : "newest";
};

const HomePage: React.FC = () => {
  const { data: user, isPending: isSessionPending } = authClient.useSession();
  const [overlays, setOverlays] = useState<OverlaySummary[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newOverlayName, setNewOverlayName] = useState("");
  const [newOverlayDescription, setNewOverlayDescription] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<OverlayPreset | null>(null);
  const [presets, setPresets] = useState<OverlayPreset[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>(readStoredSort);
  const [deleteTarget, setDeleteTarget] = useState<OverlaySummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [shareOverlayId, setShareOverlayId] = useState<string | null>(null);

  const fetchOverlays = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/overlays", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch overlays");
      }
      setOverlays(await response.json());
      setHasLoaded(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(
        errorMessage.includes("fetch")
          ? "Unable to connect to the server. Please check your internet connection and try again."
          : `Failed to load overlays: ${errorMessage}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await fetch("/presets/overlay-presets.json");
      if (!response.ok) {
        throw new Error("Failed to fetch presets");
      }
      const data = await response.json();
      setPresets(data.presets);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(
        errorMessage.includes("fetch")
          ? "Unable to load overlay templates. Please check your connection and refresh the page."
          : `Failed to load templates: ${errorMessage}`
      );
    }
  };

  // Keyed on the user id: the session object is replaced whenever better-auth refetches it
  // (e.g. on window focus), which would otherwise reload the list every time.
  const userId = user?.user.id;
  useEffect(() => {
    if (userId) {
      fetchOverlays();
    }
  }, [userId]);

  useEffect(() => {
    fetchPresets();
  }, []);

  useEffect(() => {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  }, [sort]);

  const ownCount = overlays.filter((o) => o.userId === userId).length;
  const sharedCount = overlays.length - ownCount;

  const visibleOverlays = useMemo(() => {
    const query = search.trim().toLowerCase();
    return overlays
      .filter((o) =>
        filter === "mine" ? o.userId === userId : filter === "shared" ? o.userId !== userId : true
      )
      .filter(
        (o) =>
          !query ||
          o.name.toLowerCase().includes(query) ||
          o.description?.toLowerCase().includes(query) ||
          o.members.some((m) => m.name.toLowerCase().includes(query))
      )
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
          : (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) *
            (sort === "newest" ? 1 : -1)
      );
  }, [overlays, filter, search, sort, userId]);

  const handleDuplicateOverlay = async (overlayId: string) => {
    try {
      const response = await fetch(`/api/overlays/${overlayId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to duplicate overlay");
      }
      fetchOverlays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  const handleCopyPublicUrl = (overlayId: string) => {
    const url = `${window.location.origin}/public/overlay/${overlayId}`;
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiedId(overlayId);
        setTimeout(() => setCopiedId((id) => (id === overlayId ? null : id)), 2000);
      },
      (err) => {
        alert("Failed to copy URL.");
        console.error("Could not copy text: ", err);
      }
    );
  };

  const handleDeleteOverlay = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/overlays/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete overlay");
      }
      setOverlays((current) => current.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateOverlay = async () => {
    // Clear any previous modal errors
    setModalError(null);

    if (!newOverlayName.trim()) {
      setModalError("Overlay name is required.");
      return;
    }

    if (!selectedPreset) {
      setModalError("Please select a template for your overlay.");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/overlays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOverlayName.trim(),
          description: newOverlayDescription.trim(),
          presetId: selectedPreset.id,
        }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create overlay");
      }
      fetchOverlays(); // Refetch overlays after creating a new one
      setIsDialogOpen(false); // Close the dialog
      setNewOverlayName(""); // Reset form
      setNewOverlayDescription(""); // Reset form
      setSelectedPreset(null); // Reset form
      setModalError(null); // Clear any errors
    } catch (err) {
      setModalError(
        err instanceof Error ? err.message : "An unknown error occurred while creating the overlay"
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePresetSelect = (preset: OverlayPreset) => {
    setSelectedPreset(preset);
  };

  const handleCreateNewOverlay = () => {
    setSelectedPreset(null);
    setNewOverlayName("");
    setNewOverlayDescription("");
    setModalError(null);
    setIsDialogOpen(true);
  };

  const handleTwitchSignIn = async () => {
    // Every sign-in attempt overwrites the OAuth state cookie, so a second click
    // while the first redirect is in flight makes the callback fail with state_mismatch.
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const { error } = await authClient.signIn.social({ provider: "twitch" });
      if (error) setIsSigningIn(false);
    } catch (error) {
      setIsSigningIn(false);
      throw error;
    }
  };

  if (isSessionPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Landing onSignIn={handleTwitchSignIn} isSigningIn={isSigningIn} />;
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: overlays.length },
    { value: "mine", label: "Mine", count: ownCount },
    { value: "shared", label: "Shared with me", count: sharedCount },
  ];

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 pb-16">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          {user.user.image && (
            <img
              src={user.user.image}
              alt=""
              className="hidden size-14 rounded-full ring-2 ring-primary/40 ring-offset-2 ring-offset-background sm:block"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, {user.user.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {hasLoaded
                ? `${ownCount} ${ownCount === 1 ? "overlay" : "overlays"} of your own` +
                  (sharedCount > 0 ? ` · ${sharedCount} shared with you` : "")
                : "Manage your stream overlays"}
            </p>
          </div>
        </div>
        <CreateOverlayModal
          isDialogOpen={isDialogOpen}
          setIsDialogOpen={setIsDialogOpen}
          selectedPreset={selectedPreset}
          setSelectedPreset={setSelectedPreset}
          presets={presets}
          newOverlayName={newOverlayName}
          setNewOverlayName={setNewOverlayName}
          newOverlayDescription={newOverlayDescription}
          setNewOverlayDescription={setNewOverlayDescription}
          isCreating={isCreating}
          onCreateOverlay={handleCreateOverlay}
          onPresetSelect={handlePresetSelect}
          onCreateNewOverlay={handleCreateNewOverlay}
          modalError={modalError}
        />
      </header>

      <div className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Filter overlays">
          {filters.map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  filter === value ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-72 lg:flex-none">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search overlays or people…"
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
          <Select value={sort} onValueChange={(value) => setSort(value as Sort)}>
            <SelectTrigger className="w-40 shrink-0" aria-label="Sort overlays">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchOverlays}
            disabled={isLoading}
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={cn(isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchOverlays}>
            Try again
          </Button>
        </div>
      )}

      {!hasLoaded && isLoading ? (
        <OverlayGrid>
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </OverlayGrid>
      ) : hasLoaded && overlays.length === 0 ? (
        <EmptyState onCreate={handleCreateNewOverlay} />
      ) : visibleOverlays.length > 0 ? (
        <OverlayGrid>
          {visibleOverlays.map((overlay) => (
            <OverlayCard
              key={overlay.id}
              overlay={overlay}
              isOwner={overlay.userId === userId}
              isCopied={copiedId === overlay.id}
              onCopyPublicUrl={handleCopyPublicUrl}
              onDuplicate={handleDuplicateOverlay}
              onDelete={setDeleteTarget}
              onManageAccess={setShareOverlayId}
            />
          ))}
          {filter !== "shared" && !search && (
            <button
              type="button"
              onClick={handleCreateNewOverlay}
              className="group flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/60 hover:bg-primary/5 hover:text-foreground"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Plus className="size-6" />
              </span>
              <span className="font-medium">New overlay</span>
            </button>
          )}
        </OverlayGrid>
      ) : hasLoaded ? (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <Search className="size-8 text-muted-foreground" />
          <p className="font-medium">
            {search ? `No overlays match “${search.trim()}”` : "Nothing shared with you yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {search
              ? "Try a different search or filter."
              : "When someone adds you as an editor, their overlays show up here."}
          </p>
          {search && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setSearch("")}>
              Clear search
            </Button>
          )}
        </div>
      ) : null}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              The overlay and all of its elements are deleted for everyone with access. OBS
              sources using it will stop showing anything. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteOverlay} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shareOverlayId && (
        <ShareOverlayModal
          overlayId={shareOverlayId}
          isOpen
          onClose={() => {
            setShareOverlayId(null);
            // The list of people with access may have changed.
            fetchOverlays();
          }}
        />
      )}
    </div>
  );
};

const OverlayGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {children}
  </div>
);

const CardSkeleton = () => (
  <div className="overflow-hidden rounded-xl border bg-card">
    <div className="aspect-[4/3] animate-pulse bg-muted" />
    <div className="space-y-3 border-t p-4">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
      <div className="flex items-center justify-between pt-2">
        <div className="flex">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="-ml-2 size-8 animate-pulse rounded-full bg-muted ring-2 ring-card first:ml-0"
            />
          ))}
        </div>
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  </div>
);

const EmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="relative overflow-hidden rounded-2xl border border-dashed px-6 py-20 text-center">
    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
    <div className="relative mx-auto flex max-w-md flex-col items-center gap-4">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Layers className="size-8" />
      </span>
      <h2 className="text-xl font-semibold">Create your first overlay</h2>
      <p className="text-muted-foreground">
        Start from a template with titles, counters, timers or a bingo card, then add it to OBS
        as a browser source.
      </p>
      <Button size="lg" className="mt-2" onClick={onCreate}>
        <Plus />
        New overlay
      </Button>
    </div>
  </div>
);

const FEATURES = [
  {
    icon: Zap,
    title: "Live updates",
    text: "Change counters, timers and text mid-stream. OBS picks it up instantly.",
  },
  {
    icon: Users,
    title: "Built for teams",
    text: "Share overlays with your mods so they can keep things up to date.",
  },
  {
    icon: MonitorPlay,
    title: "Drop into OBS",
    text: "Every overlay has a browser source URL. Paste it in and you're done.",
  },
];

const Landing: React.FC<{ onSignIn: () => void; isSigningIn: boolean }> = ({
  onSignIn,
  isSigningIn,
}) => (
  <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-16 py-16 text-center sm:py-24">
    <div className="flex flex-col items-center gap-6">
      <span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        Stream overlays, made simple
      </span>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        Overlays your whole team can{" "}
        <span className="bg-gradient-to-r from-primary to-fuchsia-500 bg-clip-text text-transparent">
          update live
        </span>
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Design titles, counters, timers and bingo cards, then control them from anywhere while
        you stream.
      </p>
      <Button size="lg" onClick={onSignIn} disabled={isSigningIn} className="mt-2 min-w-60">
        {isSigningIn && <Loader2 className="animate-spin" />}
        Sign in with Twitch
      </Button>
    </div>
    <div className="grid w-full gap-4 text-left sm:grid-cols-3">
      {FEATURES.map(({ icon: Icon, title, text }) => (
        <div key={title} className="rounded-xl border bg-card p-5">
          <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
      ))}
    </div>
  </div>
);

export default HomePage;
