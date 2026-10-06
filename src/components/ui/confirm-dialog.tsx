import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmLabel: React.ReactNode;
  // Shown in front of the label, replaced by a spinner while `busy`.
  icon?: React.ReactNode;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  // Anything shown between the description and the buttons.
  children?: React.ReactNode;
}

// Asks before doing something. The dialog was opened on purpose, so the confirm button has
// focus and Enter confirms; Escape or Tab to Cancel backs out.
export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  icon,
  destructive = false,
  busy = false,
  onConfirm,
  children,
}: ConfirmDialogProps) => {
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          // Radix would focus the first button, which is Cancel.
          e.preventDefault();
          confirmRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="animate-spin" /> : icon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
