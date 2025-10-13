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
import { ElementTypeEnum, type PrismaElement, type PrismaOverlay } from "@/lib/types";

interface AddElementModalProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

export const AddElementModal: React.FC<AddElementModalProps> = ({ overlay, onOverlayChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ElementTypeEnum>(ElementTypeEnum.TITLE);

  const handleAddElement = () => {
    const newElement: PrismaElement = {
      id: crypto.randomUUID(),
      name: name || `${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} Element`,
      type,
      position: overlay.elements.length,
      style: {},
      overlayId: overlay.id,
      parentId: null,
      title: type === ElementTypeEnum.TITLE ? { text: "Title" } : null,
      counter: type === ElementTypeEnum.COUNTER ? { value: 0 } : null,
    };

    const newOverlay = {
      ...overlay,
      elements: [...overlay.elements, newElement],
    };

    onOverlayChange(newOverlay);
    setIsOpen(false);
    setName("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Add Element</Button>
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
            <Select value={type} onValueChange={(v) => setType(v as ElementTypeEnum)}>
              <SelectTrigger id="element-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ElementTypeEnum.TITLE}>Title</SelectItem>
                <SelectItem value={ElementTypeEnum.COUNTER}>Counter</SelectItem>
                <SelectItem value={ElementTypeEnum.CONTAINER}>Container</SelectItem>
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
