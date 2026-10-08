import React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasRole, ROLE_INFO, SHARE_ROLES, type ShareRole } from "@/lib/sharing";
import { cn } from "@/lib/utils";

interface RolePickerProps {
  // Null when none of the roles applies (the trigger then needs a `label`).
  value: ShareRole | null;
  onChange: (role: ShareRole) => void;
  disabled?: boolean;
  // Roles below this one can't be picked, e.g. because the person already has it on every
  // overlay. `minimumNote` explains why.
  minimum?: ShareRole;
  minimumNote?: string;
  // Shows "Can edit" instead of "Editor" on the trigger.
  verb?: boolean;
  // Replaces the role name on the trigger.
  label?: React.ReactNode;
  // Shown above the roles.
  heading?: string;
  variant?: "ghost" | "outline";
  align?: "start" | "end";
  className?: string;
  // Extra items (like removing access), shown below the roles.
  children?: React.ReactNode;
}

// A compact dropdown for picking a role, every option explained.
export const RolePicker: React.FC<RolePickerProps> = ({
  value,
  onChange,
  disabled,
  minimum,
  minimumNote,
  verb = true,
  label,
  heading,
  variant = "ghost",
  align = "end",
  className,
  children,
}) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild disabled={disabled}>
      <Button
        variant={variant}
        size="sm"
        className={cn(
          "gap-1 font-normal",
          variant === "ghost" && "text-muted-foreground hover:text-foreground",
          className
        )}
      >
        {label ?? (value && (verb ? ROLE_INFO[value].verb : ROLE_INFO[value].label))}
        <ChevronDown className="size-3.5 opacity-60" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="w-72 p-1">
      {heading && (
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          {heading}
        </DropdownMenuLabel>
      )}
      {SHARE_ROLES.map((role) => {
        const { label: roleLabel, description, icon: Icon } = ROLE_INFO[role];
        const blocked = !!minimum && !hasRole(role, minimum);
        return (
          <DropdownMenuItem
            key={role}
            disabled={blocked}
            onSelect={() => role !== value && onChange(role)}
            className="items-start gap-2.5 py-2"
          >
            <Icon className="mt-0.5" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{roleLabel}</span>
              <span className="text-xs text-muted-foreground">
                {blocked && minimumNote ? minimumNote : description}
              </span>
            </span>
            <Check className={cn("mt-0.5 text-primary", role !== value && "invisible")} />
          </DropdownMenuItem>
        );
      })}
      {children && (
        <>
          <DropdownMenuSeparator />
          {children}
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);
