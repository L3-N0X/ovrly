import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrismaElement } from "@/lib/types";
import {
  formatVariableValue,
  VARIABLE_TYPE_LABELS,
  variableLabel,
  variablesApi,
  type Variable,
} from "@/lib/variables";

// Sources and keys can't contain "/", so this identifies a variable in the select.
const NONE = "__none__";
const optionValue = (variable: { source: string; key: string }) =>
  variable.source ? `${variable.source}/${variable.key}` : NONE;

// Picks which variable of the overlay owner the element shows. The value itself comes from
// the application that sends it; the server copies it into the element and broadcasts the
// overlay, so picking one is sent straight away instead of through the overlay's write queue.
const VariableControl: React.FC<{ element: PrismaElement }> = ({ element }) => {
  const binding = element.variable;
  const overlayId = element.overlayId;
  const [variables, setVariables] = useState<Variable[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!overlayId) return;
    variablesApi
      .overlayVariables(overlayId)
      .then(({ variables }) => setVariables(variables))
      .catch((err: Error) => setError(err.message));
  }, [overlayId]);

  useEffect(load, [load]);

  if (!binding) return null;

  const pick = async (value: string) => {
    const [source, key] = value === NONE ? ["", ""] : value.split("/");
    setSaving(true);
    setError(null);
    try {
      await variablesApi.bind(element.id, { source, key });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pick the variable");
    } finally {
      setSaving(false);
    }
  };

  const bySource = new Map<string, Variable[]>();
  for (const variable of variables ?? []) {
    bySource.set(variable.source, [...(bySource.get(variable.source) ?? []), variable]);
  }
  // The picked one stays selectable when the application deleted it (or hasn't sent it yet).
  const missing =
    binding.source &&
    !variables?.some((v) => v.source === binding.source && v.key === binding.key);

  return (
    <div className="space-y-2">
      <Select
        value={optionValue(binding)}
        onValueChange={pick}
        onOpenChange={(open) => open && load()}
        disabled={saving || !overlayId}
      >
        <SelectTrigger className="w-full" aria-label="Variable">
          <SelectValue placeholder="Pick a variable" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>
            <span className="text-muted-foreground">No variable</span>
          </SelectItem>
          {missing && <SelectItem value={optionValue(binding)}>{variableLabel(binding)}</SelectItem>}
          {[...bySource].map(([source, items]) => (
            <SelectGroup key={source}>
              <SelectLabel>{source}</SelectLabel>
              {items.map((variable) => (
                <SelectItem key={variable.id} value={optionValue(variable)}>
                  <span className="flex items-center gap-2">
                    {variable.key}
                    <span className="text-xs text-muted-foreground">
                      {VARIABLE_TYPE_LABELS[variable.type]}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <div className="flex h-12 items-center gap-3 rounded-md bg-secondary px-3">
        {binding.type === "COLOR" && typeof binding.value === "string" && (
          <span className="size-6 shrink-0 rounded" style={{ backgroundColor: binding.value }} />
        )}
        <span className="truncate text-2xl font-semibold tabular-nums">
          {formatVariableValue(binding.type, binding.value)}
        </span>
        {saving && <Loader2 className="ml-auto size-3 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {error ? (
        <Notice>{error}</Notice>
      ) : variables && variables.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No variables yet. Create an API key under{" "}
          <Link to="/settings?tab=api" className="underline underline-offset-2">
            Settings → API
          </Link>{" "}
          and let your app send variables with it. Variables come from the account of the
          overlay's owner.
        </p>
      ) : missing ? (
        <Notice>
          {variableLabel(binding)} hasn't been sent (or was deleted). It shows up as soon as the
          app sends it.
        </Notice>
      ) : null}
    </div>
  );
};

const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="flex gap-1.5 text-xs text-amber-600 dark:text-amber-400">
    <AlertCircle className="mt-px size-3.5 shrink-0" />
    <span>{children}</span>
  </p>
);

export default VariableControl;
