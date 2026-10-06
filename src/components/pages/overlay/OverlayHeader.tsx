import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineRename } from "@/components/ui/inline-rename";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/toggle";
import { RoleBadge } from "@/components/sharing/RoleBadge";
import { hasRole, type AccessRole } from "@/lib/sharing";
import type { PrismaOverlay, OnOverlayChange } from "@/lib/types";
import {
  Check,
  ChevronLeft,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Pencil,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import ovrlyLogo from "@/assets/ovrly-logo.png";
import EditOverlayModal from "./EditOverlayModal";
import { exportOverlay } from "./exportOverlay";

interface OverlayHeaderProps {
  overlay: PrismaOverlay;
  id: string;
  role: AccessRole;
  // How many people can open the overlay, owner included.
  memberCount?: number;
  onShare: () => void;
  onOverlayUpdate?: OnOverlayChange;
  onDelete: () => void;
}

// The editor's top bar: navigation, the overlay's name and the overlay wide actions.
const OverlayHeader: React.FC<OverlayHeaderProps> = ({
  overlay,
  id,
  role,
  memberCount,
  onShare,
  onOverlayUpdate,
  onDelete,
}) => {
  const isOwner = role === "OWNER";
  const canEdit = hasRole(role, "EDITOR");
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const publicUrl = `${window.location.origin}/public/overlay/${id}`;

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const saveDetails = async (details: { name: string; description?: string | null }) => {
    const response = await fetch(`/api/overlays/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to update overlay");
    // Built from the latest state: `overlay` is from before the request and may be stale.
    onOverlayUpdate?.((current) => ({ ...current, ...details }));
  };

  const handleEditSave = (name: string, description: string) =>
    saveDetails({ name, description: description || null });

  // Renamed in place: shown right away, and put back if it can't be saved.
  const handleRename = async (name: string) => {
    const previous = overlay.name;
    onOverlayUpdate?.((current) => ({ ...current, name }));
    try {
      await saveDetails({ name });
    } catch (error) {
      console.error("Failed to rename overlay:", error);
      onOverlayUpdate?.((current) => ({ ...current, name: previous }));
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2">
      <Button variant="ghost" size="icon-sm" asChild title="Back to overlays">
        <Link to="/" aria-label="Back to overlays">
          <ChevronLeft />
        </Link>
      </Button>
      <img src={ovrlyLogo} alt="" className="h-6 w-6 shrink-0 dark:invert" />
      <div className="mx-1 h-5 w-px shrink-0 bg-border" />

      {isRenaming ? (
        <InlineRename
          value={overlay.name}
          aria-label="Overlay name"
          className="h-7 max-w-72 text-sm font-semibold"
          onDone={(name) => {
            setIsRenaming(false);
            if (name) handleRename(name);
          }}
        />
      ) : (
        // Clicking the name renames it in place, like a file name in Figma.
        <button
          type="button"
          onClick={() => setIsRenaming(true)}
          disabled={!canEdit}
          title={canEdit ? "Rename" : undefined}
          className="group flex min-w-0 items-baseline gap-2 rounded-md px-1.5 py-1 outline-none enabled:cursor-text enabled:hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <h1 className="truncate text-sm font-semibold">{overlay.name}</h1>
          {overlay.description && (
            <span className="hidden truncate text-xs text-muted-foreground md:inline">
              {overlay.description}
            </span>
          )}
          {canEdit && (
            <Pencil className="h-3 w-3 shrink-0 self-center text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          )}
        </button>
      )}
      {!isOwner && <RoleBadge role={role} verb className="hidden sm:inline-flex" />}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button
          onClick={handleCopyToClipboard}
          variant="outline"
          size="sm"
          aria-label="Copy OBS browser source URL"
        >
          {isCopied ? <Check className="text-green-400" /> : <Copy />}
          <span className="hidden sm:inline">{isCopied ? "Copied!" : "Copy for OBS"}</span>
        </Button>
        {isOwner ? (
          <Button onClick={onShare} size="sm" aria-label="Share">
            <UserPlus />
            <span className="hidden sm:inline">Share</span>
          </Button>
        ) : (
          <Button onClick={onShare} variant="outline" size="sm" aria-label="People with access">
            <UsersRound />
            <span className="hidden sm:inline">
              {memberCount ? `${memberCount} with access` : "Access"}
            </span>
          </Button>
        )}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" title="More" aria-label="More actions">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setIsRenaming(true)}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsEditModalOpen(true)}>
                <FileText />
                Edit details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportOverlay(overlay)}>
                <Download />
                Export to JSON
              </DropdownMenuItem>
              {/* Editors may change an overlay, but only its owner may delete it. */}
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 />
                    Delete overlay
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ModeToggle />
      </div>

      <EditOverlayModal
        overlay={overlay}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSave}
      />
      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title={<>Delete “{overlay.name}”?</>}
        description="The overlay and all of its elements are deleted for everyone with access. OBS sources using it will stop showing anything. This can't be undone."
        confirmLabel="Delete overlay"
        icon={<Trash2 />}
        destructive
        onConfirm={() => {
          setIsDeleteDialogOpen(false);
          onDelete();
        }}
      />
    </header>
  );
};

export default OverlayHeader;
