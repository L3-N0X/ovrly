import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  Braces,
  ChevronDown,
  Ellipsis,
  ImageIcon,
  Loader2,
  Music,
  Plus,
  Search,
  Trash2,
  Tv,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorField } from "@/components/ui/color-picker";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/ui/number-field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";
import type { PrismaOverlay, VariableType, VariableValue } from "@/lib/types";
import { uploadImage } from "@/lib/uploads";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VARIABLE_VALUES,
  isProviderSource,
  isVariableName,
  NAME_RULES,
  providerVariableDescription,
  sourceLabel,
  SPOTIFY_SOURCE,
  spotifyProblem,
  twitchProblem,
  VARIABLE_TYPE_LABELS,
  VARIABLE_TYPES,
  variableRef,
  type Variable,
  type VariableSource,
} from "@/lib/variables";
import { spotifyApi } from "@/lib/spotify";
import { useVariables } from "@/lib/variablesContext";
import { VariableTypeIcon, VariableValuePreview } from "./VariableBits";

// What a variable created in the editor is grouped under until the user names a group.
const DEFAULT_SOURCE = "variables";
const SAVE_DELAY_MS = 300;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong";

/**
 * The variables tab of the editor: every variable of the overlay's owner, grouped by source,
 * with their live values. Values can be changed right here (controllers and up); editors also
 * create and delete variables and add Twitch channels. Spotify is connected by the owner in the
 * settings. Fields are bound to them from the fields themselves (BindableField).
 */
export const VariablesPanel: React.FC<{ overlay: PrismaOverlay; isOwner: boolean }> = ({
  overlay,
  isOwner,
}) => {
  const context = useVariables();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingTwitch, setAddingTwitch] = useState(false);
  const [addingSpotify, setAddingSpotify] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Which elements of this overlay use each variable.
  const usage = useMemo(() => {
    const users = new Map<string, string[]>();
    for (const element of overlay.elements) {
      for (const binding of element.bindings ?? []) {
        const ref = variableRef(binding);
        users.set(ref, [...(users.get(ref) ?? []), element.name]);
      }
    }
    return users;
  }, [overlay.elements]);

  if (!context) return null;
  const { variables, sources, error, canEdit } = context;
  const hasSpotify = sources.some((source) => source.provider === "SPOTIFY" && !source.problem);

  const search = query.trim().toLowerCase();
  const matching = (variables ?? []).filter(
    (variable) =>
      !search ||
      variable.key.toLowerCase().includes(search) ||
      sourceLabel(variable.source, sources).toLowerCase().includes(search)
  );
  const groups = new Map<string, Variable[]>();
  // Providers without variables yet (just added) still get their group.
  if (!search) sources.forEach((source) => groups.set(source.name, []));
  for (const variable of matching) {
    groups.set(variable.source, [...(groups.get(variable.source) ?? []), variable]);
  }
  // The user's own groups first, then providers.
  const ordered = [...groups].sort(
    ([a], [b]) => Number(isProviderSource(a)) - Number(isProviderSource(b)) || a.localeCompare(b)
  );
  const writableSources = [...new Set((variables ?? []).map((v) => v.source))].filter(
    (source) => !isProviderSource(source)
  );

  const toggle = (source: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search variables"
            aria-label="Search variables"
            className="h-8 pl-8 text-sm"
          />
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8">
                <Plus />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCreating(true)}>
                <Braces />
                Variable
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAddingTwitch(true)}>
                <Tv />
                Twitch channel
              </DropdownMenuItem>
              {!hasSpotify && (
                <DropdownMenuItem onSelect={() => setAddingSpotify(true)}>
                  <Music />
                  Spotify
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {error && (
        <p className="flex gap-1.5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}

      {variables === null && !error ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : groups.size === 0 ? (
        search ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No variables match “{query}”.</p>
        ) : (
          <EmptyState
            canEdit={canEdit}
            onCreate={() => setCreating(true)}
            onAddTwitch={() => setAddingTwitch(true)}
            onAddSpotify={() => setAddingSpotify(true)}
          />
        )
      ) : (
        ordered.map(([source, items]) => (
          <VariableGroup
            key={source}
            source={source}
            provider={sources.find((s) => s.name === source)}
            label={sourceLabel(source, sources)}
            variables={items}
            usage={usage}
            open={!collapsed.has(source) || !!search}
            onToggle={() => toggle(source)}
          />
        ))
      )}

      <p className="px-4 py-3 text-xs text-muted-foreground">
        Bind a field to a variable with the <Braces className="inline size-3 align-[-1px]" /> button
        next to its label. Other apps can update variables through the{" "}
        <Link to="/settings?tab=api" className="underline underline-offset-2">
          API
        </Link>
        .
      </p>

      <NewVariableDialog
        open={creating}
        onOpenChange={setCreating}
        sources={writableSources}
      />
      <AddTwitchDialog open={addingTwitch} onOpenChange={setAddingTwitch} />
      <AddSpotifyDialog open={addingSpotify} onOpenChange={setAddingSpotify} isOwner={isOwner} />
    </div>
  );
};

const EmptyState: React.FC<{
  canEdit: boolean;
  onCreate: () => void;
  onAddTwitch: () => void;
  onAddSpotify: () => void;
}> = ({ canEdit, onCreate, onAddTwitch, onAddSpotify }) => (
  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
    <span className="flex size-10 items-center justify-center rounded-full border bg-card">
      <Braces className="size-4 text-muted-foreground" />
    </span>
    <div>
      <p className="text-sm font-medium">No variables yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Variables are values you can bind to any fitting field: texts, numbers, colors, sizes,
        images. Change one and everything bound to it follows, in every overlay.
      </p>
    </div>
    {canEdit && (
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onCreate}>
          <Plus />
          Variable
        </Button>
        <Button size="sm" variant="outline" onClick={onAddTwitch}>
          <Tv />
          Twitch channel
        </Button>
        <Button size="sm" variant="outline" onClick={onAddSpotify}>
          <Music />
          Spotify
        </Button>
      </div>
    )}
  </div>
);

const VariableGroup: React.FC<{
  source: string;
  provider: VariableSource | undefined;
  label: string;
  variables: Variable[];
  usage: Map<string, string[]>;
  open: boolean;
  onToggle: () => void;
}> = ({ source, provider, label, variables, usage, open, onToggle }) => {
  const context = useVariables()!;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem =
    provider?.provider === "TWITCH"
      ? twitchProblem(provider)
      : provider?.provider === "SPOTIFY"
        ? spotifyProblem(provider)
        : null;
  const spotify = provider?.provider === "SPOTIFY";
  // A connected Spotify is removed by disconnecting it in the owner's settings; only one whose
  // access was revoked can be removed here.
  const removable = !spotify || !!provider?.problem;
  const used = variables.some((variable) => usage.has(variableRef(variable)));

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      if (provider) {
        context.setList(await context.api.removeSource(provider.id));
      } else {
        // A group is only its variables.
        let list = null;
        for (const variable of variables) list = await context.api.remove(variable.id);
        if (list) context.setList(list);
      }
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-b">
      <div className="group flex h-9 items-center gap-1.5 pr-2 pl-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left outline-none"
        >
          <ChevronDown
            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
          />
          {spotify ? (
            <Music className="size-3.5 shrink-0 text-[#1db954]" />
          ) : provider ? (
            <Tv className="size-3.5 shrink-0 text-violet-500" />
          ) : (
            <Braces className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-xs font-semibold">{label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{variables.length}</span>
        </button>
        {context.canEdit && removable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`More actions for ${label}`}
              >
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
                <Trash2 />
                {spotify ? "Remove Spotify" : provider ? "Remove channel" : "Delete group"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {open && (
        <>
          {problem && (
            <p className="mx-4 mb-2 flex gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              <span>{problem}</span>
            </p>
          )}
          {provider && variables.length === 0 && (
            <p className="flex items-center gap-2 px-4 pb-3 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Fetching from {spotify ? "Spotify" : "Twitch"}…
            </p>
          )}
          <div className="pb-1">
            {variables.map((variable) => (
              <VariableRow
                // Keyed by value as well, so a value changed elsewhere replaces what's shown.
                key={variable.id}
                variable={variable}
                usedBy={usage.get(variableRef(variable)) ?? []}
              />
            ))}
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={provider ? <>Remove {label}?</> : <>Delete the group “{source}”?</>}
        description={
          <>
            {provider
              ? "Its variables are deleted and no longer updated."
              : `All ${variables.length} of its variables are deleted.`}{" "}
            {used
              ? "Fields bound to them in this or other overlays go back to their own values."
              : "Fields in other overlays bound to them go back to their own values."}
            {error && <span className="mt-2 block text-destructive">{error}</span>}
          </>
        }
        confirmLabel={provider ? "Remove" : "Delete"}
        icon={<Trash2 />}
        destructive
        busy={busy}
        onConfirm={remove}
      />
    </section>
  );
};

const VariableRow: React.FC<{ variable: Variable; usedBy: string[] }> = ({ variable, usedBy }) => {
  const context = useVariables()!;
  const provider = context.sources.find((source) => source.name === variable.source);
  const readOnly = isProviderSource(variable.source) || !context.canControl;
  // Held while editing, so the list being fetched again after each save doesn't move the
  // field out from under the user.
  const [editing, setEditing] = useState(false);
  const { value, setValue } = useLocalCopy(variable.value, editing);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const save = useDebouncedCallback(async (next: VariableValue) => {
    try {
      await context.api.setValue(variable.id, next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, SAVE_DELAY_MS);

  const change = (next: VariableValue) => {
    setValue(next);
    save(next);
  };

  const remove = async () => {
    try {
      context.setList(await context.api.remove(variable.id));
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const description = providerVariableDescription(provider, variable.key);

  return (
    <div
      className="group/row px-4 py-1"
      onFocusCapture={() => setEditing(true)}
      onBlurCapture={() => setEditing(false)}
    >
      <div className="flex min-h-8 items-center gap-2">
        <VariableTypeIcon type={variable.type} />
        <span
          className="min-w-0 flex-1 truncate text-sm"
          title={isProviderSource(variable.source) && description ? description : variable.key}
        >
          {variable.key}
        </span>
        {usedBy.length > 0 && (
          <span
            className="shrink-0 rounded-full bg-violet-500/15 px-1.5 text-[10px] font-medium text-violet-600 tabular-nums dark:text-violet-300"
            title={`Used by ${usedBy.join(", ")}`}
          >
            {usedBy.length}
          </span>
        )}
        <div className="flex w-32 shrink-0 justify-end">
          {readOnly ? (
            <VariableValuePreview type={variable.type} value={value} className="max-w-32" />
          ) : (
            <ValueEditor
              type={variable.type}
              value={value}
              onChange={change}
              onPickingChange={setEditing}
              label={variable.key}
              compact
            />
          )}
        </div>
        {context.canEdit && !isProviderSource(variable.source) && (
          <button
            type="button"
            title="Delete variable"
            aria-label={`Delete ${variable.key}`}
            onClick={() => (usedBy.length > 0 ? setConfirming(true) : remove())}
            className="-mr-2 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-hover/row:opacity-100 hover:bg-accent hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      {error && <p className="pb-1 pl-5.5 text-xs text-destructive">{error}</p>}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={<>Delete “{variable.key}”?</>}
        description={`${usedBy.join(", ")} ${usedBy.length === 1 ? "is" : "are"} bound to it and go back to their own values.`}
        confirmLabel="Delete"
        icon={<Trash2 />}
        destructive
        onConfirm={remove}
      />
    </div>
  );
};

// Edits a value of any type.
const ValueEditor: React.FC<{
  type: VariableType;
  value: VariableValue;
  onChange: (value: VariableValue) => void;
  // While a picker (colour, image) is open.
  onPickingChange?: (picking: boolean) => void;
  label: string;
  compact?: boolean;
  id?: string;
}> = ({ type, value, onChange, onPickingChange, label, compact, id }) => {
  switch (type) {
    case "STRING":
      return (
        <Input
          id={id}
          value={String(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          maxLength={1000}
          className={cn(compact && "h-7 px-2 text-xs")}
        />
      );
    case "INTEGER":
    case "DOUBLE":
      return (
        <NumberField
          id={id}
          value={typeof value === "number" ? value : 0}
          step={type === "INTEGER" ? 1 : 0.01}
          stepper={!compact}
          size={compact ? "sm" : "default"}
          aria-label={label}
          onChange={onChange}
          className={cn(compact && "h-7 w-full")}
        />
      );
    case "BOOLEAN":
      return <Switch id={id} checked={value === true} onCheckedChange={onChange} aria-label={label} />;
    case "COLOR":
      return (
        <ColorField
          id={id}
          value={String(value)}
          onChange={onChange}
          onOpenChange={onPickingChange}
          aria-label={label}
          className={cn(compact && "w-full [&>button]:h-7 [&>button]:pl-1 [&>button_span:first-child]:size-5")}
        />
      );
    case "IMAGE":
      return (
        <ImageValueEditor
          value={String(value)}
          onChange={onChange}
          onPickingChange={onPickingChange}
          compact={compact}
        />
      );
  }
};

// An image URL, typed in or uploaded.
const ImageValueEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onPickingChange?: (picking: boolean) => void;
  compact?: boolean;
}> = ({ value, onChange, onPickingChange, compact }) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Popover onOpenChange={onPickingChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border border-input bg-input/30 px-1.5 text-left text-xs outline-none hover:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring",
            compact ? "h-7" : "h-10"
          )}
        >
          {value ? (
            <img src={value} alt="" className="size-5 shrink-0 rounded-sm object-cover" />
          ) : (
            <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.replace(/^.*\//, "") : "Pick an image"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2 p-3">
        <Label className="text-xs">Image URL</Label>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          placeholder="https://…"
          className="h-8 text-xs"
        />
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
          {uploading ? "Uploading…" : "Upload an image"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={upload} />
      </PopoverContent>
    </Popover>
  );
};

const NewVariableDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The groups variables can be created in, to pick from.
  sources: string[];
}> = ({ open, onOpenChange, sources }) => {
  const context = useVariables()!;
  const [type, setType] = useState<VariableType>("STRING");
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [key, setKey] = useState("");
  const [value, setValue] = useState<VariableValue>(DEFAULT_VARIABLE_VALUES.STRING);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setKey("");
    setValue(DEFAULT_VARIABLE_VALUES[type]);
    setError(null);
  };

  const invalid =
    !isVariableName(source) ? `Group: ${NAME_RULES}` : key && !isVariableName(key) ? `Name: ${NAME_RULES}` : null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key || invalid) return;
    setSaving(true);
    setError(null);
    try {
      context.setList(await context.api.create({ source, key, type, value }));
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New variable</DialogTitle>
            <DialogDescription>
              Bind it to any field of a fitting type. It belongs to the overlay owner's account, so
              every overlay of it can use it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="new-variable-type">Type</Label>
              <Select
                value={type}
                onValueChange={(next) => {
                  setType(next as VariableType);
                  setValue(DEFAULT_VARIABLE_VALUES[next as VariableType]);
                }}
              >
                <SelectTrigger id="new-variable-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      <VariableTypeIcon type={option} />
                      {VARIABLE_TYPE_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-variable-source">Group</Label>
              <Input
                id="new-variable-source"
                list="new-variable-sources"
                value={source}
                onChange={(event) => setSource(event.target.value.trim())}
              />
              <datalist id="new-variable-sources">
                {sources.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-variable-key">Name</Label>
            <Input
              id="new-variable-key"
              value={key}
              onChange={(event) => setKey(event.target.value.trim())}
              placeholder="red.points"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-variable-value">Value</Label>
            <ValueEditor id="new-variable-value" type={type} value={value} onChange={setValue} label="Value" />
          </div>
          {(invalid || error) && <p className="text-sm text-destructive">{invalid ?? error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !key || !!invalid}>
              {saving && <Loader2 className="animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddTwitchDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const context = useVariables()!;
  const [channel, setChannel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!channel.trim()) return;
    setSaving(true);
    setError(null);
    try {
      context.setList(await context.api.addTwitchChannel(channel.trim()));
      setChannel("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a Twitch channel</DialogTitle>
            <DialogDescription>
              Any channel works. Its name, avatar, followers, viewers, live status, title and
              category become variables that stay up to date while an overlay is open.
              Subscriber stats need the channel connected under Settings → Twitch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="twitch-channel">Channel</Label>
            <Input
              id="twitch-channel"
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              placeholder="Name or link, e.g. twitch.tv/shroud"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !channel.trim()}>
              {saving && <Loader2 className="animate-spin" />}
              Add channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AddSpotifyDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Only the owner's Spotify shows up in their overlays, so only they can connect it.
  isOwner: boolean;
}> = ({ open, onOpenChange, isOwner }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Add Spotify</DialogTitle>
        <DialogDescription>
          What is playing on Spotify becomes variables: track, artist, album, cover, whether it
          plays, progress and length (in seconds and as text like 1:23), volume, and an accent
          colour taken from the cover. Bind a progress bar's value and maximum to{" "}
          <code className="text-xs">progress</code> and <code className="text-xs">duration</code>,
          and running to <code className="text-xs">playing</code>, so it moves smoothly.
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm text-muted-foreground">
        {isOwner
          ? "Spotify asks you to allow ovrly to read what you play, then sends you to your settings. This overlay picks it up right away."
          : `The owner of this overlay connects their Spotify account in their settings. Their variables are called “${SPOTIFY_SOURCE}”, which you can already bind to.`}
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {isOwner ? "Cancel" : "Close"}
        </Button>
        {isOwner && (
          <Button asChild>
            {/* A full page load: the server sends the browser on to Spotify. */}
            <a href={spotifyApi.connectUrl}>
              <Music />
              Connect Spotify
            </a>
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
