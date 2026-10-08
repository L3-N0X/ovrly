import React from "react";
import { Input } from "@/components/ui/input";
import { BindableField } from "@/components/variables/BindableField";
import type { PrismaElement } from "@/lib/types";

interface TitleControlProps {
  element: PrismaElement;
  handleTitleChange: (elementId: string, text: string) => void;
}

const TitleControl: React.FC<TitleControlProps> = ({ element, handleTitleChange }) => {
  return (
    <BindableField property="text" label="Text" htmlFor={`title-${element.id}`}>
      <Input
        id={`title-${element.id}`}
        aria-label={`${element.name} text`}
        value={element.title?.text || ""}
        onChange={(e) => handleTitleChange(element.id, e.target.value)}
        placeholder="Enter title text"
      />
    </BindableField>
  );
};

export default TitleControl;
