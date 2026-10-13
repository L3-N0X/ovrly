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
    <div className="flex items-center gap-2">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
        <IconGlyph library={icon.library} name={icon.name} size={20} />
      </div>
      <p className="min-w-0 flex-1 truncate text-sm">
        {readableIconName(icon.name)}
        <span className="text-muted-foreground"> · {iconLibraryInfo(icon.library).label}</span>
      </p>
      <IconPicker value={icon} onChange={(next) => onIconChange(element.id, next)}>
        <Button variant="secondary" size="sm" className="shrink-0">
          Change
        </Button>
      </IconPicker>
    </div>
  );
};

export default IconControl;
