import React from "react";
import { Link } from "react-router-dom";
import {
  Check,
  ClipboardCopy,
  CopyPlus,
  ExternalLink,
  Layers,
  Link2,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import AvatarStack, { Avatar } from "@/components/home/AvatarStack";
import { ROLE_LABELS } from "@/components/home/members";
import OverlayPreview from "@/components/home/OverlayPreview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { OverlaySummary } from "@/lib/types";

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

// "3 days ago", "last week", ... falling back to "just now" for the last minute.
const timeAgo = (date: string) => {
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
  }
  return "just now";
};

interface OverlayCardProps {
  overlay: OverlaySummary;
  isOwner: boolean;
  isCopied: boolean;
  onCopyPublicUrl: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (overlay: OverlaySummary) => void;
  onManageAccess: (id: string) => void;
}

const OverlayCard: React.FC<OverlayCardProps> = ({
  overlay,
  isOwner,
  isCopied,
  onCopyPublicUrl,
  onDuplicate,
  onDelete,
  onManageAccess,
}) => {
  const editorUrl = `/overlay/${overlay.id}`;
  const owner = overlay.members.find((m) => m.role === "owner");
  const elementCount = overlay.elements.length;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 focus-within:border-primary/40">
      <div className="relative">
        <OverlayPreview
          overlay={overlay}
          className="transition-transform duration-500 group-hover:scale-[1.02]"
        />
        {/* Fades in on hover to show what clicking the card does. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-background/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg">
            <Pencil className="size-4" />
            Open editor
          </span>
        </div>
        <div className="pointer-events-none absolute top-3 left-3 flex gap-1.5">
          {!isOwner && (
            <span className="flex items-center gap-1.5 rounded-full bg-black/60 py-1 pr-2.5 pl-1 text-xs font-medium text-white backdrop-blur">
              {owner ? <Avatar member={owner} className="size-5 text-[10px]" /> : <Users className="size-3.5" />}
              Shared by {owner?.name ?? "someone"}
            </span>
          )}
        </div>
        <span className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white/90 backdrop-blur">
          <Layers className="size-3" />
          {elementCount} {elementCount === 1 ? "element" : "elements"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 border-t p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">
              {/* Stretched over the whole card, so the card is one big link. Controls sit
                  above it (relative z-10) and stay clickable. */}
              <Link
                to={editorUrl}
                className="outline-none after:absolute after:inset-0 after:content-['']"
              >
                {overlay.name}
              </Link>
            </h3>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {overlay.description || "No description"}
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              title={isCopied ? "Copied!" : "Copy browser source URL for OBS"}
              aria-label="Copy browser source URL for OBS"
              onClick={() => onCopyPublicUrl(overlay.id)}
            >
              {isCopied ? <Check className="text-emerald-500" /> : <Link2 />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link to={editorUrl}>
                    <Pencil />
                    Open editor
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/public/overlay/${overlay.id}`} target="_blank" rel="noreferrer">
                    <ExternalLink />
                    Open public view
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopyPublicUrl(overlay.id)}>
                  <ClipboardCopy />
                  Copy URL for OBS
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onManageAccess(overlay.id)}>
                  <UserPlus />
                  {isOwner ? "Manage access" : "View access"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(overlay.id)}>
                  <CopyPlus />
                  Duplicate
                </DropdownMenuItem>
                {/* Only the owner may delete an overlay. */}
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(overlay)}>
                      <Trash2 />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="relative z-10 -m-1 flex items-center gap-2 rounded-full p-1 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label={`${overlay.members.length} ${
                  overlay.members.length === 1 ? "person has" : "people have"
                } access`}
              >
                <AvatarStack members={overlay.members} />
                {isOwner && overlay.members.length === 1 && (
                  <span className="pr-2 text-xs text-muted-foreground">Only you</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                People with access
              </div>
              <ul className="max-h-60 space-y-0.5 overflow-y-auto p-1.5">
                {overlay.members.map((member) => (
                  <li key={member.name} className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                    <Avatar member={member} className="size-7" />
                    <span className="min-w-0 flex-1 truncate text-sm">{member.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ROLE_LABELS[member.role]}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t p-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => onManageAccess(overlay.id)}
                >
                  <UserPlus />
                  {isOwner ? "Manage access" : "View details"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <time
            dateTime={overlay.createdAt}
            title={`Created ${new Date(overlay.createdAt).toLocaleString()}`}
            className="shrink-0 text-xs text-muted-foreground"
          >
            Created {timeAgo(overlay.createdAt)}
          </time>
        </div>
      </div>
    </article>
  );
};

export default OverlayCard;
