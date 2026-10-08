import React, { useEffect, useId, useRef, useState } from "react";
import { AtSign, Loader2, UserPlus } from "lucide-react";
import { Avatar } from "@/components/home/AvatarStack";
import { Button } from "@/components/ui/button";
import { sharingApi, type ShareRole, type UserSuggestion } from "@/lib/sharing";
import { cn } from "@/lib/utils";
import { RolePicker } from "./RolePicker";

const SEARCH_DEBOUNCE_MS = 150;

interface InviteFormProps {
  onInvite: (twitchName: string, role: ShareRole) => Promise<void>;
  // People (by lower-cased name) who already have access; they're marked in the suggestions.
  existing?: Set<string>;
  defaultRole?: ShareRole;
  submitLabel?: string;
  autoFocus?: boolean;
}

// A Twitch name field that suggests ovrly users (and people already shared with) as you
// type, next to a role picker. Anyone can be invited by name, even before they sign up.
export const InviteForm: React.FC<InviteFormProps> = ({
  onInvite,
  existing,
  defaultRole = "EDITOR",
  submitLabel = "Invite",
  autoFocus,
}) => {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<ShareRole>(defaultRole);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = name.trim().replace(/^@/, "");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      sharingApi
        .searchUsers(query)
        .then((results) => {
          if (cancelled) return;
          setSuggestions(results);
          setActiveIndex(-1);
        })
        .catch(() => !cancelled && setSuggestions([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  const submit = async (twitchName = query) => {
    if (!twitchName || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      await onInvite(twitchName, role);
      setName("");
      setIsOpen(false);
      // Ready for the next name.
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not share");
    } finally {
      setIsBusy(false);
    }
  };

  const exactMatch = suggestions.some((s) => s.name.toLowerCase() === query.toLowerCase());
  // The "invite by name" row comes after the suggestions.
  const hasInviteRow = !!query && !exactMatch;
  const optionCount = suggestions.length + (hasInviteRow ? 1 : 0);
  const showList = isOpen && optionCount > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && optionCount > 0) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) =>
        event.key === "ArrowDown"
          ? (index + 1) % optionCount
          : index <= 0
            ? optionCount - 1
            : index - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      submit(suggestions[activeIndex]?.name ?? query);
    } else if (event.key === "Escape" && isOpen) {
      // Keeps the surrounding dialog open; only the suggestions close.
      event.stopPropagation();
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <div
            className={cn(
              "flex h-9 items-center rounded-md border border-input bg-input/30 shadow-xs transition-[color,box-shadow]",
              "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
              error && "border-destructive"
            )}
          >
            <AtSign className="ml-3 size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={name}
              autoFocus={autoFocus}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
                setIsOpen(true);
              }}
              onClick={() => setIsOpen(true)}
              onBlur={() => setIsOpen(false)}
              onKeyDown={onKeyDown}
              placeholder="Twitch name"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-label="Twitch name to share with"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <RolePicker value={role} onChange={setRole} verb className="mr-0.5 h-7 px-2 text-xs" />
          </div>

          {showList && (
            <ul
              id={listId}
              role="listbox"
              // Clicking a suggestion would blur the input (and close the list) first.
              onMouseDown={(event) => event.preventDefault()}
              className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
            >
              {suggestions.length > 0 && (
                <li className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {query ? "People on ovrly" : "People you share with"}
                </li>
              )}
              {suggestions.map((suggestion, index) => {
                const hasAccess = existing?.has(suggestion.name.toLowerCase());
                return (
                  <li
                    key={suggestion.name}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => submit(suggestion.name)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                      index === activeIndex && "bg-accent text-accent-foreground"
                    )}
                  >
                    <Avatar member={suggestion} className="size-6 text-[10px]" />
                    <span className="min-w-0 flex-1 truncate">{suggestion.name}</span>
                    {hasAccess ? (
                      <span className="text-xs text-muted-foreground">Has access</span>
                    ) : suggestion.pending ? (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    ) : null}
                  </li>
                );
              })}
              {hasInviteRow && (
                <li
                  role="option"
                  aria-selected={activeIndex === suggestions.length}
                  onMouseEnter={() => setActiveIndex(suggestions.length)}
                  onClick={() => submit(query)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                    activeIndex === suggestions.length && "bg-accent text-accent-foreground"
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed">
                    <UserPlus className="size-3 text-muted-foreground" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    Invite <span className="font-medium">@{query}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">by Twitch name</span>
                </li>
              )}
            </ul>
          )}
        </div>
        <Button onClick={() => submit()} disabled={!query || isBusy} className="shrink-0">
          {isBusy && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
