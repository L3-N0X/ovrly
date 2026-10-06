import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Globe, Link2, Loader2, LogOut, UserX } from "lucide-react";
import { Avatar } from "@/components/home/AvatarStack";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  ROLE_INFO,
  sharingApi,
  type OverlayAccess,
  type OverlayAccessMember,
  type ShareRole,
} from "@/lib/sharing";
import { cn } from "@/lib/utils";
import { InviteForm } from "./InviteForm";
import { PendingBadge, RoleBadge } from "./RoleBadge";
import { RolePicker } from "./RolePicker";

interface ShareDialogProps {
  overlayId: string;
  overlayName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called after access changed, e.g. to refresh a list of overlays.
  onChanged?: () => void;
  // Called after the current user left the overlay.
  onLeft?: () => void;
}

// Who has access to an overlay. The owner invites people, changes their role and removes
// them; everyone else sees the list and can leave.
export const ShareDialog: React.FC<ShareDialogProps> = ({
  overlayId,
  overlayName,
  open,
  onOpenChange,
  onChanged,
  onLeft,
}) => {
  const [access, setAccess] = useState<OverlayAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAccess(await sharingApi.overlayAccess(overlayId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load who has access");
    }
  }, [overlayId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Runs a change that answers with the new access list.
  const change = async (key: string, action: () => Promise<OverlayAccess>) => {
    setBusyKey(key);
    setError(null);
    try {
      setAccess(await action());
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setBusyKey(null);
    }
  };

  const leave = async (member: OverlayAccessMember) => {
    if (!member.overlayShare) return;
    setBusyKey(member.key);
    try {
      await sharingApi.leave("overlay", member.overlayShare.id);
      onOpenChange(false);
      onLeft?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setBusyKey(null);
    }
  };

  const existing = useMemo(
    () => new Set(access?.members.map((m) => m.key) ?? []),
    [access?.members]
  );
  const canManage = !!access?.canManage;
  const count = access ? access.members.length + 1 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-[540px]">
        <DialogHeader className="space-y-1 border-b px-6 pt-5 pb-4 text-left">
          <DialogTitle className="text-base">
            {canManage ? "Share" : "People with access"}
            {overlayName && <span className="text-muted-foreground"> · {overlayName}</span>}
          </DialogTitle>
          <DialogDescription>
            {canManage
              ? "Invite mods and co-streamers by their Twitch name and choose what they can do."
              : access
                ? `You ${ROLE_INFO[access.role].verb.toLowerCase()} this overlay. Only ${access.owner.name} can change who has access.`
                : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        {canManage && (
          <div className="border-b px-6 py-4">
            <InviteForm
              autoFocus
              existing={existing}
              onInvite={async (name, role) => {
                const next = await sharingApi.shareOverlay(overlayId, name, role);
                setAccess(next);
                onChanged?.();
              }}
            />
          </div>
        )}

        <div className="px-6 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground">
              People with access{access && ` · ${count}`}
            </h3>
            {busyKey && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>

          {error && (
            <p className="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          {!access ? (
            <MemberSkeleton />
          ) : (
            <ul className="-mx-2 max-h-[min(22rem,50vh)] space-y-0.5 overflow-y-auto">
              <MemberRow
                name={access.owner.name}
                image={access.owner.image}
                isYou={access.owner.isYou}
                trailing={<RoleBadge role="OWNER" />}
              />
              {access.members.map((member) => (
                <MemberRow
                  key={member.key}
                  name={member.name}
                  image={member.image}
                  isYou={member.isYou}
                  pending={member.pending}
                  note={memberNote(member)}
                  dimmed={busyKey === member.key}
                  trailing={
                    canManage ? (
                      <ManageMember
                        member={member}
                        disabled={busyKey !== null}
                        onRole={(role) =>
                          change(member.key, () =>
                            member.overlayShare
                              ? sharingApi.setOverlayRole(overlayId, member.overlayShare.id, role)
                              : sharingApi.shareOverlay(overlayId, member.name, role)
                          )
                        }
                        onRemove={() =>
                          member.overlayShare &&
                          change(member.key, () =>
                            sharingApi.unshareOverlay(overlayId, member.overlayShare!.id)
                          )
                        }
                      />
                    ) : member.isYou && member.overlayShare ? (
                      <div className="flex items-center gap-2">
                        <RoleBadge role={member.role} verb />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={busyKey !== null}
                          onClick={() => leave(member)}
                        >
                          <LogOut />
                          Leave
                        </Button>
                      </div>
                    ) : (
                      <RoleBadge role={member.role} verb />
                    )
                  }
                />
              ))}
              {canManage && access.members.length === 0 && (
                <li className="mx-2 mt-2 rounded-lg border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                  Only you can open this overlay. Invite a mod to help run your stream.
                </li>
              )}
            </ul>
          )}
        </div>

        <PublicLinkFooter overlayId={overlayId} showTeamLink={canManage} />
      </DialogContent>
    </Dialog>
  );
};

// Why someone has the access they have, when it doesn't come from this overlay alone.
const memberNote = (member: OverlayAccessMember) => {
  if (!member.accountShare) return null;
  const accountRole = ROLE_INFO[member.accountShare.role].label;
  return member.overlayShare && member.overlayShare.role !== member.accountShare.role
    ? `${accountRole} on all overlays, raised here`
    : `${accountRole} on all overlays`;
};

const ManageMember: React.FC<{
  member: OverlayAccessMember;
  disabled: boolean;
  onRole: (role: ShareRole) => void;
  onRemove: () => void;
}> = ({ member, disabled, onRole, onRemove }) => {
  const accountRole = member.accountShare?.role;
  return (
    <RolePicker
      value={member.role}
      onChange={onRole}
      disabled={disabled}
      minimum={accountRole}
      minimumNote={accountRole && `Has ${ROLE_INFO[accountRole].label} on all your overlays`}
    >
      {member.overlayShare && (
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <UserX />
          {accountRole ? "Remove overlay-specific access" : "Remove access"}
        </DropdownMenuItem>
      )}
      {accountRole && (
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <ArrowUpRight />
            Manage access to all overlays
          </Link>
        </DropdownMenuItem>
      )}
    </RolePicker>
  );
};

export const MemberRow: React.FC<{
  name: string;
  image: string | null;
  isYou?: boolean;
  pending?: boolean;
  note?: string | null;
  dimmed?: boolean;
  trailing?: React.ReactNode;
}> = ({ name, image, isYou, pending, note, dimmed, trailing }) => (
  <li
    className={cn(
      "flex min-h-12 items-center gap-3 rounded-lg px-2 py-1.5 transition-opacity hover:bg-muted/40",
      dimmed && "opacity-60"
    )}
  >
    <Avatar
      member={{ name, image }}
      className={cn("size-8", pending && "opacity-60 ring-1 ring-border ring-offset-0")}
    />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        {isYou && <span className="shrink-0 text-xs text-muted-foreground">(you)</span>}
        {pending && <PendingBadge />}
      </div>
      {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
    </div>
    {trailing}
  </li>
);

const MemberSkeleton = () => (
  <div className="space-y-3 py-1">
    {[0, 1].map((i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="size-8 animate-pulse rounded-full bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
    ))}
  </div>
);

// The OBS link is public by design, so the dialog says so and offers to copy it.
const PublicLinkFooter: React.FC<{ overlayId: string; showTeamLink: boolean }> = ({
  overlayId,
  showTeamLink,
}) => {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/public/overlay/${overlayId}`;

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-b-lg border-t bg-muted/30 px-6 py-4 sm:flex-row sm:items-center">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        <Globe className="size-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Browser source link</p>
        <p className="text-xs text-muted-foreground">
          Anyone with the link sees the live output, but can't change anything.
          {showTeamLink && (
            <>
              {" "}
              <Link to="/settings" className="text-foreground underline-offset-4 hover:underline">
                Manage team access
              </Link>
            </>
          )}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="text-emerald-500" /> : <Link2 />}
        {copied ? "Copied" : "Copy link"}
      </Button>
    </div>
  );
};
