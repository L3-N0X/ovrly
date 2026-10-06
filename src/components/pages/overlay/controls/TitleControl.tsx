import React from "react";
import { Input } from "@/components/ui/input";
import type { PrismaElement } from "@/lib/types";

interface TitleControlProps {
  element: PrismaElement;
  handleTitleChange: (elementId: string, text: string) => void;
}

const TitleControl: React.FC<TitleControlProps> = ({ element, handleTitleChange }) => {
  return (
    <Input
      id={`title-${element.id}`}
      aria-label={`${element.name} text`}
      value={element.title?.text || ""}
      onChange={(e) => handleTitleChange(element.id, e.target.value)}
      placeholder="Enter title text"
    />
  );
};

export default TitleControl;
