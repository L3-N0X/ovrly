import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ElementTypeEnum, type ElementType, type PrismaOverlay, type OnOverlayChange } from "@/lib/types";
import { Plus } from "lucide-react";

interface AddElementModalProps {
  overlay: PrismaOverlay;
  onOverlayChange: OnOverlayChange;
  // Called with the id of the new element, e.g. to select it.
  onAdded?: (elementId: string) => void;
}

export const AddElementModal: React.FC<AddElementModalProps> = ({
  overlay,
  onOverlayChange,
  onAdded,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ElementType>(ElementTypeEnum.TITLE);

  const handleAddElement = async () => {
    const response = await fetch(`/api/overlays/${overlay.id}/elements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name:
          name.trim() || `${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} Element`,
        type,
      }),
    });

    if (response.ok) {
      // Only the new element is taken from the response. Adopting the whole response would
      // revert local edits that haven't been saved yet (and save the older values again).
      const updatedOverlay: PrismaOverlay = await response.json();
      const known = new Set(overlay.elements.map((el) => el.id));
      const newElement = updatedOverlay.elements.find((el) => !known.has(el.id));
      onOverlayChange((current) => {
        const known = new Set(current.elements.map((el) => el.id));
        const added = updatedOverlay.elements.filter((el) => !known.has(el.id));
        return { ...current, elements: [...current.elements, ...added] };
      });
      if (newElement) onAdded?.(newElement.id);
      setIsOpen(false);
      setName("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Add element" aria-label="Add element">
          <Plus />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a new element</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="element-name">Name (optional)</Label>
            <Input
              id="element-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My new element"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="element-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ElementType)}>
              <SelectTrigger id="element-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ElementTypeEnum.TITLE}>Title</SelectItem>
                <SelectItem value={ElementTypeEnum.COUNTER}>Counter</SelectItem>
                <SelectItem value={ElementTypeEnum.TIMER}>Timer</SelectItem>
                <SelectItem value={ElementTypeEnum.IMAGE}>Image</SelectItem>
                <SelectItem value={ElementTypeEnum.BINGO}>Bingo</SelectItem>
                <SelectItem value={ElementTypeEnum.CONTAINER}>Container</SelectItem>
                <SelectItem value={ElementTypeEnum.GROUP}>Group (free positioning)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddElement} className="w-full">
            Add Element
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
