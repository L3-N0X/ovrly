import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrismaOverlay } from "@/lib/types";

interface EditOverlayModalProps {
  overlay: PrismaOverlay;
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

// The overlay's name and description. Enter in either field saves.
const EditOverlayModal: React.FC<EditOverlayModalProps> = ({ overlay, isOpen, onClose, onSave }) => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Overlay details</DialogTitle>
        <DialogDescription>Only you and the people you share it with see these.</DialogDescription>
      </DialogHeader>
      {/* Mounted with the dialog, so every opening starts from the current values. */}
      <DetailsForm overlay={overlay} onClose={onClose} onSave={onSave} />
    </DialogContent>
  </Dialog>
);

const DetailsForm = ({
  overlay,
  onClose,
  onSave,
}: Pick<EditOverlayModalProps, "overlay" | "onClose" | "onSave">) => {
  const [name, setName] = useState(overlay.name);
  const [description, setDescription] = useState(overlay.description || "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError("The overlay needs a name.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="overlay-name">Name</Label>
        <Input
          id="overlay-name"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          disabled={isSaving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="overlay-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="overlay-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it's for, e.g. “Speedrun layout”"
          disabled={isSaving}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
};

export default EditOverlayModal;
