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
import { type PrismaElement, type OnOverlayChange } from "@/lib/types";
import { useLocalCopy } from "@/lib/hooks/useLocalCopy";

interface RenameElementModalProps {
  element: PrismaElement;
  onOverlayChange: OnOverlayChange;
  children: React.ReactNode;
}

export const RenameElementModal: React.FC<RenameElementModalProps> = ({
  element,
  onOverlayChange,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Track the latest server name while closed, then preserve edits while the dialog is open.
  const { value: name, setValue: setName } = useLocalCopy(element.name, isOpen);

  const handleRenameElement = async () => {
    if (!name.trim()) return;

    const response = await fetch(`/api/elements/${element.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });

    if (response.ok) {
      const updatedElement = await response.json();

      // Built from the latest state: `overlay` is from before the request and may be stale.
      onOverlayChange((current) => ({
        ...current,
        elements: current.elements.map((el) =>
          el.id === element.id ? { ...el, name: updatedElement.name } : el
        ),
      }));

      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Element</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="element-name">Name</Label>
            <Input
              id="element-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter new name"
            />
          </div>
          <Button onClick={handleRenameElement} className="w-full">
            Rename
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
