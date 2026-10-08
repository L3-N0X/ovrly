import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VariableValuePreview } from "@/components/variables/VariableBits";
import {
  sourceLabel,
  VARIABLE_TYPE_LABELS,
  variablesApi,
  type ApiKey,
  type Variable,
  type VariablesResponse,
} from "@/lib/variables";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
};

// API keys let other applications (a game server, a Stream Deck, a bot) send variables to this
// account, which fields of overlays then show once they are bound to them. The API is documented in docs/public-api.md.
export const ApiSettings: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[] | null>(null);
  const [list, setList] = useState<VariablesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadVariables = useCallback(() => {
    variablesApi
      .variables()
      .then(setList)
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    variablesApi
      .apiKeys()
      .then(({ apiKeys }) => setApiKeys(apiKeys))
      .catch((err: Error) => setError(err.message));
    loadVariables();
  }, [loadVariables]);

  const run = async (id: string | null, action: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    await run(null, async () => {
      const result = await variablesApi.createApiKey(name.trim());
      setApiKeys(result.apiKeys);
      setNewKey(result.key);
      setName("");
    });
    setCreating(false);
  };

  const revoke = (apiKey: ApiKey) => {
    setRevokeTarget(null);
    run(apiKey.id, async () => setApiKeys((await variablesApi.deleteApiKey(apiKey.id)).apiKeys));
  };

  const deleteVariable = (variable: Variable) =>
    run(variable.id, async () => setList(await variablesApi.deleteVariable(variable.id)));

  const baseUrl = `${window.location.origin}/api/v1`;
  const example = `curl -X PUT ${baseUrl}/sources/my-app/variables/score \\
  -H "Authorization: Bearer <your key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "type": "integer", "value": 42 }'`;

  const variables = list?.variables;
  const sources = list?.sources;
  const bySource = new Map<string, Variable[]>();
  for (const variable of variables ?? []) {
    bySource.set(variable.source, [...(bySource.get(variable.source) ?? []), variable]);
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <section className="rounded-xl border bg-card">
        <div className="space-y-1 p-5 pb-4">
          <h2 className="font-medium">Send variables from other apps</h2>
          <p className="text-sm text-muted-foreground">
            With an API key, other apps (a game server, a Stream Deck, a bot) can send variables
            to your account: texts, numbers, yes/no values, colors and images. Bind a field of
            an element to one (the variable button next to its label) and it updates live
            whenever the app sends a new value. People on your team see your variables in your
            overlays.
          </p>
        </div>
        <div className="space-y-3 px-5 pb-5">
          <pre className="overflow-x-auto rounded-md bg-secondary p-3 text-xs">{example}</pre>
          <form onSubmit={create} className="flex gap-2">
            <Input
              aria-label="Key name"
              placeholder="What is the key for? e.g. Minecraft server"
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              Create API key
            </Button>
          </form>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="font-medium">API keys</h2>
          <p className="text-sm text-muted-foreground">
            Anyone with a key can change your variables. Revoke keys you no longer use.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          {!apiKeys ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <ul className="divide-y">
              {apiKeys.map((apiKey) => (
                <li key={apiKey.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <KeyRound className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{apiKey.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      <code>{apiKey.prefix}…</code> · created {formatDate(apiKey.createdAt)} ·{" "}
                      {apiKey.lastUsedAt
                        ? `last used ${formatDateTime(apiKey.lastUsedAt)}`
                        : "never used"}
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => setRevokeTarget(apiKey)}
                  >
                    {busyId === apiKey.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end gap-3">
          <div className="flex-1">
            <h2 className="font-medium">Variables</h2>
            <p className="text-sm text-muted-foreground">
              Everything your account has, by app or provider. Deleted ones come back when they
              are sent again.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadVariables}>
            <RefreshCw />
            Refresh
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          {!variables ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : variables.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No variables yet. They show up here once an app sends them or you create one in an
              overlay's Variables tab.
            </p>
          ) : (
            [...bySource].map(([source, items]) => (
              <div key={source} className="border-b last:border-b-0">
                <h3 className="bg-secondary/50 px-4 py-2 text-xs font-medium sm:px-5">
                  {sourceLabel(source, sources)}
                </h3>
                <ul className="divide-y">
                  {items.map((variable) => (
                    <li key={variable.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                      <code className="min-w-0 flex-1 truncate text-sm">{variable.key}</code>
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">
                        {VARIABLE_TYPE_LABELS[variable.type]}
                      </span>
                      <span className="flex w-40 shrink-0 items-center gap-2 truncate text-sm">
                        <VariableValuePreview
                          type={variable.type}
                          value={variable.value}
                          className="text-sm"
                        />
                      </span>
                      <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
                        {formatDateTime(variable.updatedAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${variable.key}`}
                        disabled={busyId !== null}
                        onClick={() => deleteVariable(variable)}
                      >
                        {busyId === variable.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your new API key</DialogTitle>
            <DialogDescription>
              Copy it now and paste it into your app. It is only shown this once; if you lose
              it, create a new one.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md bg-secondary p-3 text-sm">{newKey}</code>
          <DialogFooter>
            {newKey && <CopyButton text={newKey} label="Copy key" />}
            <Button onClick={() => setNewKey(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title={`Revoke ${revokeTarget?.name}?`}
        description="Apps using this key can no longer send variables. Variables it already sent stay until you delete them."
        confirmLabel="Revoke"
        destructive
        onConfirm={() => revokeTarget && revoke(revokeTarget)}
      />
    </div>
  );
};
