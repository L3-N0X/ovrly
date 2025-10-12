import {
  ElementTypeEnum,
  type ElementStyle,
  type PrismaElement,
  type PrismaOverlay,
} from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { TitleStyleEditor } from "./TitleEditor";
import { CounterStyleEditor } from "./CounterEditor";
import { ContainerStyleEditor } from "./ContainerEditor";

interface ElementListEditorProps {
  overlay: PrismaOverlay;
  onOverlayChange: (updatedOverlay: PrismaOverlay) => void;
}

export const ElementListEditor: React.FC<ElementListEditorProps> = ({ overlay, onOverlayChange }) => {
  const [expandedElementIds, setExpandedElementIds] = useState<Set<string>>(new Set());

  const updateElementStyle = (elementId: string, newStyle: ElementStyle) => {
    const newOverlay = JSON.parse(JSON.stringify(overlay));
    const elementIndex = newOverlay.elements.findIndex((el: PrismaElement) => el.id === elementId);
    if (elementIndex > -1) {
      newOverlay.elements[elementIndex].style = newStyle;
      onOverlayChange(newOverlay);
    }
  };

  const toggleElementExpansion = (elementId: string) => {
    setExpandedElementIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(elementId)) {
        newSet.delete(elementId);
      } else {
        newSet.add(elementId);
      }
      return newSet;
    });
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Elements</h3>
      <div className="space-y-2">
        {overlay.elements.map((element) => {
          const isExpanded = expandedElementIds.has(element.id);
          return (
            <div key={element.id}>
              <div onClick={() => toggleElementExpansion(element.id)}>
                <div
                  className={`flex p-3 gap-3 rounded-md hover:cursor-pointer hover:bg-accent
                    ${isExpanded ? "bg-muted" : ""}`}
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown className="h-6 w-6 mr-1" />
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-6 w-6 mr-1" />
                    </>
                  )}
                  <div className="flex items-center w-full justify-between">
                    <span className="text-lg font-medium">{element.name}</span>
                    <Chip className="ml-1 text-xs text-muted-foreground">{element.type}</Chip>
                  </div>
                </div>
              </div>
              {isExpanded && (
                <div className="animate-fadeIn overflow-hidden">
                  {element.type === ElementTypeEnum.TITLE && (
                    <TitleStyleEditor
                      element={element}
                      onChange={(style) => updateElementStyle(element.id, style)}
                    />
                  )}
                  {element.type === ElementTypeEnum.COUNTER && (
                    <CounterStyleEditor
                      element={element}
                      onChange={(style) => updateElementStyle(element.id, style)}
                    />
                  )}
                  {element.type === ElementTypeEnum.CONTAINER && (
                    <ContainerStyleEditor
                      element={element}
                      onChange={(style) => updateElementStyle(element.id, style)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
