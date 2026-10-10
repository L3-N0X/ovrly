import React, { useRef, useState } from "react";
import { AlertCircle, Braces, Check, Settings2, Unlink } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  acceptsType,
  bindingKind,
  bindingOf,
  isContentProperty,
  KIND_LABELS,
  type BindingKind,
} from "@/lib/bindings";
import { cn } from "@/lib/utils";
import { sourceLabel, variableRef, type Variable } from "@/lib/variables";
import { useBindingElement, useVariables, type BindingTarget } from "@/lib/variablesContext";
import type { VariableBinding } from "@/lib/types";
import { VariableTypeIcon, VariableValuePreview } from "./VariableBits";

interface BindableFieldProps {
  // The property the field edits, as lib/bindings.ts names it ("text", "style.color"). Without
  // one it is a plain labelled field.
  property?: string;
  label: React.ReactNode;
  htmlFor?: string;
  // For switches, whose label sits next to them rather than above.
  inline?: boolean;
  // Controls shown at the end of the label's row (not for inline fields).
  actions?: React.ReactNode;
  className?: string;
  // The field itself, shown while the property isn't bound.
  children: React.ReactNode;
}

/**
 * A labelled field whose property can be bound to a variable, like in Figma: the label gets a
 * button that picks a variable of a fitting type, and while one is bound the field is replaced by
 * the variable, which can be detached again.
 *
 * It needs the variables (VariablesProvider) and the element (BindingElementContext); without
 * them, or for a property its element type can't bind, it is a plain labelled field, so shared
 * inputs can always render through it.
 */
export const BindableField: React.FC<BindableFieldProps> = ({
  property,
  label,
  htmlFor,
  inline,
  actions,
  className,
  children,
}) => {
  const variables = useVariables();
  const element = useBindingElement();
  const kind = element && property ? bindingKind(element.type, property) : undefined;
  const [picking, setPicking] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  // What had focus in the field when the picker opened, to go back to once it closes.
  const returnFocus = useRef<HTMLElement | null>(null);

  if (!variables || !element || !property || !kind) {
    return inline ? (
      <div className={cn("flex items-center space-x-2", className)}>
        {children}
        <Label htmlFor={htmlFor}>{label}</Label>
      </div>
    ) : (
      <div className={cn("space-y-2", className)}>
        {actions ? (
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={htmlFor}>{label}</Label>
            {actions}
          </div>
        ) : (
          <Label htmlFor={htmlFor}>{label}</Label>
        )}
        {children}
      </div>
    );
  }

  const binding = bindingOf(element, property);
  const canBind = isContentProperty(property) ? variables.canControl : variables.canEdit;
  const bind = (target: BindingTarget | null) => {
    setPicking(false);
    variables.onBind(element.id, property, target);
  };
  const openPicker = () => {
    const focused = document.activeElement;
    returnFocus.current =
      focused instanceof HTMLElement && fieldRef.current?.contains(focused) ? focused : null;
    setPicking(true);
  };
  // Alt+V opens the picker from anywhere in the field, since the bind button can't be tabbed to.
  // By code, as Option+V types a character on macOS.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!canBind || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.code !== "KeyV") return;
    e.preventDefault();
    e.stopPropagation();
    openPicker();
  };
  // Back into the field, or into what replaced it once a variable was bound or detached.
  const onCloseAutoFocus = (e: Event) => {
    const target = returnFocus.current;
    returnFocus.current = null;
    if (!target) return;
    e.preventDefault();
    const next = target.isConnected
      ? target
      : fieldRef.current?.querySelector<HTMLElement>(
          "input, textarea, select, button:not([tabindex='-1']), [tabindex]:not([tabindex='-1'])"
        );
    next?.focus();
  };

  // Out of the tab order, so tabbing through a form goes from field to field (Alt+V instead).
  const bindButton = canBind && (
    <button
      type="button"
      tabIndex={-1}
      title="Bind to a variable (Alt+V)"
      aria-label={`Bind ${typeof label === "string" ? label : "field"} to a variable`}
      aria-keyshortcuts="Alt+V"
      onClick={openPicker}
      className={cn(
        "-my-1 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover/bind:opacity-100 group-focus-within/bind:opacity-100",
        picking && "opacity-100"
      )}
    >
      <Braces className="size-3.5" />
    </button>
  );

  const field =
    inline && !binding ? (
      <div className="flex items-center gap-2">
        {children}
        <Label htmlFor={htmlFor}>{label}</Label>
        <span className="ml-auto flex">{bindButton}</span>
      </div>
    ) : (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={binding ? undefined : htmlFor}>{label}</Label>
          {(actions || !binding) && (
            <div className="flex items-center gap-1">
              {!binding && bindButton}
              {actions}
            </div>
          )}
        </div>
        {binding ? (
          <BoundVariable
            binding={binding}
            variable={variables.variables?.find((v) => variableRef(v) === variableRef(binding))}
            loaded={variables.variables !== null}
            sourceName={sourceLabel(binding.source, variables.sources)}
            onPick={canBind ? openPicker : undefined}
            onDetach={canBind ? () => bind(null) : undefined}
          />
        ) : (
          children
        )}
      </div>
    );

  return (
    <Popover open={picking} onOpenChange={setPicking}>
      <PopoverAnchor asChild>
        <div ref={fieldRef} onKeyDown={onKeyDown} className={cn("group/bind", className)}>
          {field}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="end"
        className="w-72 p-0"
        onCloseAutoFocus={onCloseAutoFocus}
        // Clicking elsewhere closes it without pulling focus back from what was clicked.
        onInteractOutside={() => (returnFocus.current = null)}
      >
        <VariablePicker kind={kind} binding={binding} onBind={bind} />
      </PopoverContent>
    </Popover>
  );
};

// The bound variable in place of the field.
const BoundVariable: React.FC<{
  binding: VariableBinding;
  variable: Variable | undefined;
  loaded: boolean;
  sourceName: string;
  onPick?: () => void;
  onDetach?: () => void;
}> = ({ binding, variable, loaded, sourceName, onPick, onDetach }) => {
  const missing = loaded && !variable;
  return (
    <div
      className={cn(
        "flex h-9 w-full min-w-0 items-center gap-1.5 rounded-md border pr-1 pl-2 text-sm",
        missing
          ? "border-amber-500/50 bg-amber-500/10"
          : "border-violet-500/40 bg-violet-500/10"
      )}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={!onPick}
        title={`${binding.key} · ${sourceName}${onPick ? " (pick another variable)" : ""}`}
        className="@container flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left outline-none disabled:cursor-default"
      >
        {variable ? (
          <VariableTypeIcon type={variable.type} className="text-violet-500" />
        ) : (
          <Braces className="size-3.5 shrink-0 text-violet-500" />
        )}
        <span className="min-w-0 truncate font-medium">
          {binding.key}
        </span>
        {/* Only where there is room, so narrow fields still show which variable it is. */}
        <span className="hidden min-w-0 truncate text-xs text-muted-foreground @[13rem]:inline">
          {sourceName}
        </span>
      </button>
      {variable ? (
        <VariableValuePreview
          type={variable.type}
          value={variable.value}
          compact
          className="max-w-16 shrink-0"
        />
      ) : (
        missing && (
          <span title="There is no variable of this name (any more). The field shows its own value until there is.">
            <AlertCircle className="size-3.5 shrink-0 text-amber-500" />
          </span>
        )
      )}
      {onDetach && (
        <button
          type="button"
          title="Detach variable"
          aria-label="Detach variable"
          onClick={onDetach}
          className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Unlink className="size-3.5" />
        </button>
      )}
    </div>
  );
};

// The owner's variables that fit the property, grouped by source and searchable.
const VariablePicker: React.FC<{
  kind: BindingKind;
  binding: VariableBinding | undefined;
  onBind: (target: BindingTarget | null) => void;
}> = ({ kind, binding, onBind }) => {
  const context = useVariables()!;
  const fitting = (context.variables ?? []).filter((variable) => acceptsType(kind, variable.type));
  const groups = new Map<string, Variable[]>();
  for (const variable of fitting) {
    groups.set(variable.source, [...(groups.get(variable.source) ?? []), variable]);
  }

  return (
    <Command>
      <CommandInput placeholder="Search variables" />
      <CommandList className="max-h-72">
        <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {context.variables === null
            ? "Loading variables…"
            : fitting.length === 0
              ? `No ${KIND_LABELS[kind]} variables yet.`
              : "No matching variables."}
        </CommandEmpty>
        {[...groups].map(([source, items]) => {
          const name = sourceLabel(source, context.sources);
          return (
            <CommandGroup key={source} heading={name}>
              {items.map((variable) => {
                const ref = variableRef(variable);
                const selected = binding !== undefined && variableRef(binding) === ref;
                return (
                  <CommandItem
                    key={variable.id}
                    value={ref}
                    keywords={[variable.key, name]}
                    onSelect={() => onBind({ source: variable.source, key: variable.key })}
                  >
                    <VariableTypeIcon type={variable.type} />
                    <span className="min-w-0 truncate">{variable.key}</span>
                    <VariableValuePreview
                      type={variable.type}
                      value={variable.value}
                      className="ml-auto max-w-24 text-muted-foreground"
                    />
                    <Check className={cn("size-3.5", !selected && "invisible")} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
      {(binding || context.showVariables) && (
        <div className="flex border-t p-1">
          {binding && (
            <button
              type="button"
              onClick={() => onBind(null)}
              className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            >
              <Unlink className="size-3.5" />
              Detach
            </button>
          )}
          {context.showVariables && (
            <button
              type="button"
              onClick={context.showVariables}
              className="flex flex-1 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent"
            >
              <Settings2 className="size-3.5" />
              Manage variables
            </button>
          )}
        </div>
      )}
    </Command>
  );
};
