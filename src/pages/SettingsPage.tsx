import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Ellipsis,
  Inbox,
  Layers,
  ListChecks,
  Loader2,
  LogOut,
  Plus,
  Search,
  UserX,
  UsersRound,
} from "lucide-react";
import { Avatar } from "@/components/home/AvatarStack";
import { InviteForm } from "@/components/sharing/InviteForm";
import { PendingBadge, RoleBadge } from "@/components/sharing/RoleBadge";
import { RolePicker } from "@/components/sharing/RolePicker";
import { TwitchConnections } from "@/components/settings/TwitchConnections";
import { ApiSettings } from "@/components/settings/ApiSettings";
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
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  ROLE_INFO,
  SHARE_ROLES,
  sharingApi,
  type IncomingResponse,
  type PeopleResponse,
  type SharedPerson,
  type ShareRole,
} from "@/lib/sharing";
import { cn } from "@/lib/utils";

type Tab = "people" | "incoming" | "twitch" | "api";
const TABS: Tab[] = ["people", "incoming", "twitch", "api"];

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// Shown once the list gets long enough to need it.
const SEARCH_THRESHOLD = 6;

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((value) => value === params.get("tab")) ?? "people";
  const [people, setPeople] = useState<PeopleResponse | null>(null);
  const [incoming, setIncoming] = useState<IncomingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPeople = useCallback(
    () =>
      sharingApi
        .people()
        .then(setPeople)
        .catch((err: Error) => setError(err.message)),
    []
  );
  const loadIncoming = useCallback(
    () =>
      sharingApi
        .incoming()
        .then(setIncoming)
        .catch((err: Error) => setError(err.message)),
    []
  );

  useEffect(() => {
    loadPeople();
    loadIncoming();
  }, [loadPeople, loadIncoming]);

  const incomingCount = incoming ? incoming.accounts.length + incoming.overlays.length : null;
  const tabs: { value: Tab; label: string; count: number | null }[] = [
    { value: "people", label: "Your team", count: people?.people.length ?? null },
    { value: "incoming", label: "Shared with you", count: incomingCount },
    { value: "twitch", label: "Twitch", count: null },
    { value: "api", label: "API", count: null },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl pb-20">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Decide who can view, run and edit your overlays, see what others shared with you,
          connect Twitch channels, and let other apps send variables to your overlays.
        </p>
      </header>

      <nav className="mb-8 flex gap-6 border-b" aria-label="Settings sections">
        {tabs.map(({ value, label, count }) => (
          <button
            key={value}
            type="button"
            onClick={() => setParams(value === "people" ? {} : { tab: value }, { replace: true })}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "-mb-px flex cursor-pointer items-center gap-2 border-b-2 pb-3 text-sm transition-colors",
              tab === value
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {count !== null && count > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {error && (
        <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === "people" ? (
        <TeamTab data={people} onData={setPeople} onError={setError} reload={loadPeople} />
      ) : tab === "incoming" ? (
        <IncomingTab data={incoming} onData={setIncoming} onError={setError} />
      ) : tab === "twitch" ? (
        <TwitchConnections connected={params.get("connected")} errorCode={params.get("error")} />
      ) : (
        <ApiSettings />
      )}
    </div>
  );
}

// ---- Your team ------------------------------------------------------------------------------

const TeamTab: React.FC<{
  data: PeopleResponse | null;
  onData: (data: PeopleResponse) => void;
  onError: (error: string | null) => void;
  reload: () => Promise<unknown>;
}> = ({ data, onData, onError, reload }) => {
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SharedPerson | null>(null);

  // Runs a change for one person, then shows the new state.
  const run = async (key: string, action: () => Promise<PeopleResponse | unknown>) => {
    setBusyKey(key);
    onError(null);
    try {
      const result = await action();
      if (result && typeof result === "object" && "people" in result) {
        onData(result as PeopleResponse);
      } else {
        await reload();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update access");
    } finally {
      setBusyKey(null);
    }
  };

  const existing = useMemo(() => new Set(data?.people.map((p) => p.key) ?? []), [data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.people ?? []).filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.overlayShares.some((s) => s.overlay.name.toLowerCase().includes(q))
    );
  }, [data, query]);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card">
        <div className="space-y-1 p-5 pb-4">
          <h2 className="font-medium">Add to your team</h2>
          <p className="text-sm text-muted-foreground">
            Gives access to every overlay you own, including the ones you create later. To share a
            single overlay, use Share in its editor.
          </p>
        </div>
        <div className="px-5 pb-5">
          <InviteForm
            existing={existing}
            submitLabel="Add"
            onInvite={async (name, role) => onData(await sharingApi.shareAccount(name, role))}
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-medium">People with access</h2>
            <p className="text-sm text-muted-foreground">
              Everyone who can open at least one of your overlays.
            </p>
          </div>
          {data && data.people.length >= SEARCH_THRESHOLD && (
            <div className="relative w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter people or overlays"
                className="h-8 pl-8 text-sm"
              />
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          {!data ? (
            <ListSkeleton />
          ) : data.people.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="No one else has access yet"
              text="Add your mods above so they can run counters, timers and bingo while you stream."
            />
          ) : visible.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No one matches “{query.trim()}”.
            </p>
          ) : (
            <ul className="divide-y">
              {visible.map((person) => (
                <PersonRow
                  key={person.key}
                  person={person}
                  overlays={data.overlays}
                  busy={busyKey === person.key}
                  disabled={busyKey !== null}
                  run={(action) => run(person.key, action)}
                  onRemove={() => setRemoveTarget(person)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      <RoleGuide />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name}?`}
        description={`${removeTarget?.name} loses access to all of your overlays right away. You can invite them again any time.`}
        confirmLabel="Remove from everything"
        onConfirm={() => {
          const person = removeTarget;
          setRemoveTarget(null);
          if (person) run(person.key, () => sharingApi.removePerson(person.key));
        }}
      />
    </div>
  );
};

const PersonRow: React.FC<{
  person: SharedPerson;
  overlays: PeopleResponse["overlays"];
  busy: boolean;
  disabled: boolean;
  run: (action: () => Promise<unknown>) => void;
  onRemove: () => void;
}> = ({ person, overlays, busy, disabled, run, onRemove }) => {
  const [expanded, setExpanded] = useState(false);
  const { accountShare, overlayShares } = person;
  const sharedIds = new Set(overlayShares.map((s) => s.overlay.id));
  // Editors on every overlay can't be given more on a single one.
  const unshared =
    accountShare?.role === "EDITOR" ? [] : overlays.filter((o) => !sharedIds.has(o.id));

  const setAccountRole = (role: ShareRole) =>
    run(() =>
      accountShare
        ? sharingApi.setAccountRole(accountShare.id, role)
        : sharingApi.shareAccount(person.name, role)
    );

  const summary = [
    accountShare ? "All overlays" : null,
    overlayShares.length > 0
      ? `${overlayShares.length} ${overlayShares.length === 1 ? "overlay" : "overlays"}${accountShare ? " with extra access" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={cn("transition-opacity", busy && "opacity-60")}>
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Hide" : "Show"} overlays for ${person.name}`}
          className="-m-1 flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
          <Avatar member={person} className={cn("size-9", person.pending && "opacity-60")} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{person.name}</span>
              {person.pending && <PendingBadge />}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {summary} · since {formatDate(person.since)}
            </span>
          </span>
        </button>

        <RolePicker
          value={accountShare?.role ?? null}
          onChange={setAccountRole}
          disabled={disabled}
          heading="Access to all your overlays"
          label={
            accountShare ? (
              <>
                <span className="hidden sm:inline">All overlays ·</span>
                {ROLE_INFO[accountShare.role].verb}
              </>
            ) : (
              "Selected overlays"
            )
          }
          variant="outline"
          className="h-8"
        >
          <DropdownMenuItem
            disabled={!accountShare || overlayShares.length === 0}
            onSelect={() => accountShare && run(() => sharingApi.unshareAccount(accountShare.id))}
            className="items-start gap-2.5 py-2"
          >
            <ListChecks className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Only selected overlays</span>
              <span className="text-xs text-muted-foreground">
                {accountShare && overlayShares.length === 0
                  ? "Add them to an overlay first, or remove them."
                  : "Keeps just the overlays listed for them."}
              </span>
            </span>
          </DropdownMenuItem>
        </RolePicker>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button variant="ghost" size="icon-sm" aria-label={`More for ${person.name}`}>
              {busy ? <Loader2 className="animate-spin" /> : <Ellipsis />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setExpanded(true)}>
              <Layers />
              Manage overlays
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <UserX />
              Remove from everything
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 sm:pr-5 sm:pl-[4.25rem]">
          {overlayShares.length === 0 ? (
            <p className="py-1 text-xs text-muted-foreground">
              {accountShare
                ? `No overlay-specific access. ${person.name} gets ${ROLE_INFO[accountShare.role].label} on all of your overlays.`
                : "Not added to any overlay."}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {overlayShares.map((share) => (
                <li key={share.id} className="flex items-center gap-3 rounded-md py-1">
                  <Layers className="size-3.5 shrink-0 text-muted-foreground" />
                  <Link
                    to={`/overlay/${share.overlay.id}`}
                    className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
                  >
                    {share.overlay.name}
                  </Link>
                  <RolePicker
                    value={share.role}
                    disabled={disabled}
                    minimum={accountShare?.role}
                    minimumNote={
                      accountShare
                        ? `Already ${ROLE_INFO[accountShare.role].label} on all your overlays`
                        : undefined
                    }
                    onChange={(role) =>
                      run(() => sharingApi.setOverlayRole(share.overlay.id, share.id, role))
                    }
                    className="h-7"
                  >
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        run(() => sharingApi.unshareOverlay(share.overlay.id, share.id))
                      }
                    >
                      <UserX />
                      Remove from this overlay
                    </DropdownMenuItem>
                  </RolePicker>
                </li>
              ))}
            </ul>
          )}
          {unshared.length > 0 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <Button variant="ghost" size="sm" className="mt-1 -ml-2 h-7 text-muted-foreground">
                  <Plus />
                  Add to an overlay
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-64">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                  Starts as {ROLE_INFO[newOverlayRole(person)].label}, change it afterwards
                </DropdownMenuLabel>
                {unshared.map((overlay) => (
                  <DropdownMenuItem
                    key={overlay.id}
                    onSelect={() =>
                      run(() =>
                        sharingApi.shareOverlay(overlay.id, person.name, newOverlayRole(person))
                      )
                    }
                  >
                    <Layers />
                    <span className="truncate">{overlay.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </li>
  );
};

// A per-overlay share only matters when it allows more than the account share, so a new one
// starts one step above it (or as controller, the most common role for mods).
const newOverlayRole = (person: SharedPerson): ShareRole => {
  const accountRole = person.accountShare?.role;
  if (!accountRole) return "CONTROLLER";
  // SHARE_ROLES runs from most to least access.
  return SHARE_ROLES[Math.max(0, SHARE_ROLES.indexOf(accountRole) - 1)];
};

const RoleGuide = () => (
  <section>
    <h2 className="mb-3 font-medium">Roles</h2>
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
      {SHARE_ROLES.map((role) => {
        const { label, description, icon: Icon } = ROLE_INFO[role];
        return (
          <div key={role} className="bg-card p-4">
            <div className="mb-2 flex size-8 items-center justify-center rounded-md border bg-background">
              <Icon className="size-4 text-primary" />
            </div>
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        );
      })}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">
      Only you can delete your overlays and change who has access. Someone with access to all
      overlays and to a single one gets whichever role allows more.
    </p>
  </section>
);

// ---- Shared with you ------------------------------------------------------------------------

const IncomingTab: React.FC<{
  data: IncomingResponse | null;
  onData: (data: IncomingResponse) => void;
  onError: (error: string | null) => void;
}> = ({ data, onData, onError }) => {
  const [leaveTarget, setLeaveTarget] = useState<{
    kind: "account" | "overlay";
    id: string;
    title: string;
    description: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const leave = async (kind: "account" | "overlay", id: string) => {
    setBusyId(id);
    onError(null);
    try {
      onData(await sharingApi.leave(kind, id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not leave");
    } finally {
      setBusyId(null);
    }
  };

  if (!data) {
    return (
      <div className="overflow-hidden rounded-xl border bg-card">
        <ListSkeleton />
      </div>
    );
  }

  if (data.accounts.length === 0 && data.overlays.length === 0) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Inbox}
          title="Nothing shared with you yet"
          text="When a streamer adds you by your Twitch name, their overlays show up here and on your home page."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {data.accounts.length > 0 && (
        <section>
          <h2 className="mb-1 font-medium">Teams you're on</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            You can open every overlay of these streamers.
          </p>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {data.accounts.map((share) => (
              <li
                key={share.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 sm:px-5",
                  busyId === share.id && "opacity-60"
                )}
              >
                <Avatar member={share.owner} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{share.owner.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    All {share.overlayCount} {share.overlayCount === 1 ? "overlay" : "overlays"} ·
                    since {formatDate(share.createdAt)}
                  </p>
                </div>
                <RoleBadge role={share.role} verb />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busyId !== null}
                  onClick={() =>
                    setLeaveTarget({
                      kind: "account",
                      id: share.id,
                      title: `Leave ${share.owner.name}'s team?`,
                      description: `You lose access to all of ${share.owner.name}'s overlays, unless one was also shared with you on its own. They can add you again.`,
                    })
                  }
                >
                  <LogOut />
                  Leave
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.overlays.length > 0 && (
        <section>
          <h2 className="mb-1 font-medium">Overlays</h2>
          <p className="mb-3 text-sm text-muted-foreground">Shared with you one by one.</p>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {data.overlays.map((share) => (
              <li
                key={share.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 sm:px-5",
                  busyId === share.id && "opacity-60"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                  <Layers className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/overlay/${share.overlay.id}`}
                    className="block truncate text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {share.overlay.name}
                  </Link>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Avatar member={share.owner} className="size-4 text-[8px]" />
                    {share.owner.name}
                  </p>
                </div>
                <RoleBadge role={share.role} verb />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={busyId !== null}
                  onClick={() =>
                    setLeaveTarget({
                      kind: "overlay",
                      id: share.id,
                      title: `Leave “${share.overlay.name}”?`,
                      description: `You lose access to this overlay, unless you're on ${share.owner.name}'s team.`,
                    })
                  }
                >
                  <LogOut />
                  Leave
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={!!leaveTarget}
        onOpenChange={(open) => !open && setLeaveTarget(null)}
        title={leaveTarget?.title ?? ""}
        description={leaveTarget?.description ?? ""}
        confirmLabel="Leave"
        onConfirm={() => {
          const target = leaveTarget;
          setLeaveTarget(null);
          if (target) leave(target.kind, target.id);
        }}
      />
    </div>
  );
};

// ---- Shared pieces --------------------------------------------------------------------------

const EmptyState: React.FC<{ icon: React.ElementType; title: string; text: string }> = ({
  icon: Icon,
  title,
  text,
}) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <span className="mb-4 flex size-11 items-center justify-center rounded-full border bg-background">
      <Icon className="size-5 text-muted-foreground" />
    </span>
    <p className="font-medium">{title}</p>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
  </div>
);

const ListSkeleton = () => (
  <div className="divide-y">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-4">
        <div className="size-9 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="ml-auto h-8 w-32 animate-pulse rounded-md bg-muted" />
      </div>
    ))}
  </div>
);

const ConfirmDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}> = ({ open, onOpenChange, title, description, confirmLabel, onConfirm }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-base">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
