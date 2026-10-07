import React from "react";
import { Button } from "@/components/ui/button";
import { IconPicker } from "@/components/IconPicker";
import IconGlyph from "@/components/overlay/IconGlyph";
import { iconLibraryInfo, readableIconName } from "@/lib/icons";
import type { IconLibrary, PrismaElement } from "@/lib/types";

interface IconControlProps {
  element: PrismaElement;
  onIconChange: (elementId: string, icon: { library: IconLibrary; name: string }) => void;
}

const IconControl: React.FC<IconControlProps> = ({ element, onIconChange }) => {
  const icon = element.icon;
  if (!icon) return null;

  return (
    <div className="flex items-center space-x-2">
      <div className="w-15 h-15 rounded-md bg-secondary flex shrink-0 items-center justify-center">
        <IconGlyph library={icon.library} name={icon.name} size={32} />
      </div>
      <div className="flex flex-col flex-1 min-w-0 mr-0">
        <p className="text-sm text-muted-foreground mb-1 h-5 truncate overflow-hidden whitespace-nowrap">
          {readableIconName(icon.name)} · {iconLibraryInfo(icon.library).label}
        </p>
        <IconPicker value={icon} onChange={(next) => onIconChange(element.id, next)}>
          <Button variant="secondary" className="flex-grow">
            Change Icon
          </Button>
        </IconPicker>
      </div>
    </div>
  );
};

export default IconControl;
