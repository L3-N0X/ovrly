import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_COMPONENT_DESCRIPTION_LENGTH, MAX_COMPONENT_NAME_LENGTH } from "@/lib/components";

export interface ComponentDetails {
  name: string;
  description: string | null;
}

// A component's name and description, in a dialog. Mount it with the dialog's content, so
// every opening starts from `initial`. Enter in either field submits.
export const ComponentDetailsForm = ({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ComponentDetails;
  submitLabel: string;
  // Rejects with the message to show.
  onSubmit: (details: ComponentDetails) => Promise<void>;
  onCancel: () => void;
}) => {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!name.trim()) {
      setError("The component needs a name.");
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the component");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="component-name">Name</Label>
        <Input
          id="component-name"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          value={name}
          maxLength={MAX_COMPONENT_NAME_LENGTH}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          disabled={isSaving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="component-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="component-description"
          value={description}
          maxLength={MAX_COMPONENT_DESCRIPTION_LENGTH}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it shows, e.g. “Now playing with cover art”"
          disabled={isSaving}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
};
