import { useState } from "react";
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
  isLoading?: boolean;
}

const EditOverlayModal: React.FC<EditOverlayModalProps> = ({
  overlay,
  isOpen,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const [name, setName] = useState(overlay.name);
  const [description, setDescription] = useState(overlay.description || "");
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Overlay name is required");
      return;
    }

    setError(null);
    try {
      await onSave(name.trim(), description.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    }
  };

  const handleClose = () => {
    setName(overlay.name);
    setDescription(overlay.description || "");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Overlay</DialogTitle>
          <DialogDescription>Update your overlay's name and description.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Overlay Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Overlay"
              className={error ? "border-destructive focus:border-destructive" : ""}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Overlay Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short description of what this overlay is for."
              disabled={isLoading}
            />
          </div>
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditOverlayModal;
