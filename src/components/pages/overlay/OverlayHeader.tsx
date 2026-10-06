import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const [isSaving, setIsSaving] = useState(false);
  const publicUrl = `${window.location.origin}/public/overlay/${id}`;

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleEditSave = async (name: string, description: string) => {
    if (!onOverlayUpdate) return;

    setIsSaving(true);
    try {
      // Update the overlay via API
      const response = await fetch(`/api/overlays/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || null,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update overlay");
      }

      // Built from the latest state: `overlay` is from before the request and may be stale.
      onOverlayUpdate((current) => ({ ...current, name, description: description || null }));
    } catch (error) {
      console.error("Failed to update overlay:", error);
      throw error;
    } finally {
      setIsSaving(false);
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

      <button
        type="button"
        onClick={() => setIsEditModalOpen(true)}
        disabled={!canEdit}
        title={canEdit ? "Edit name and description" : undefined}
        className="group flex min-w-0 items-baseline gap-2 rounded-md px-1.5 py-1 enabled:cursor-pointer enabled:hover:bg-accent"
      >
        <h1 className="truncate text-sm font-semibold">{overlay.name}</h1>
        {overlay.description && (
          <span className="hidden truncate text-xs text-muted-foreground md:inline">
            {overlay.description}
          </span>
        )}
        {canEdit && (
          <Pencil className="h-3 w-3 shrink-0 self-center text-muted-foreground opacity-0 group-hover:opacity-100" />
        )}
      </button>
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
              <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                <Pencil />
                Edit name and description
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
                    onClick={() => setIsDeleteDialogOpen(true)}
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
        isLoading={isSaving}
      />
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{overlay.name}”?</DialogTitle>
            <DialogDescription>
              The overlay and all of its elements are removed for good. OBS sources pointing to
              it will show nothing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                onDelete();
              }}
            >
              Delete overlay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default OverlayHeader;
