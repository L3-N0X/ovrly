import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PrismaElement } from "@/lib/types";

interface TitleControlProps {
  element: PrismaElement;
  handleTitleChange: (elementId: string, text: string) => void;
}

const TitleControl: React.FC<TitleControlProps> = ({ element, handleTitleChange }) => {
  return (
    <div className="space-y-2">
      <Label htmlFor={`title-${element.id}`}>Title: {element.name}</Label>
      <Input
        id={`title-${element.id}`}
        value={element.title?.text || ""}
        onChange={(e) => handleTitleChange(element.id, e.target.value)}
        placeholder="Enter title text"
      />
    </div>
  );
};

export default TitleControl;
