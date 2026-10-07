import React, { useCallback, useMemo, useState } from "react";
import { List } from "react-window";
import type { RowComponentProps } from "react-window";
import { Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { IconSvg } from "@/components/overlay/IconGlyph";
import { GRID_ITEM_ATTRIBUTE, handleGridKeyDown } from "@/lib/gridNavigation";
import {
  ICON_LIBRARIES,
  iconLibraryInfo,
  iconNames,
  iconVariant,
  readableIconName,
  useIconSet,
  type IconSet,
} from "@/lib/icons";
import type { IconLibrary } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PickedIcon {
  library: IconLibrary;
  name: string;
}

const COLUMNS = 8;
const ROW_HEIGHT = 60;
const GRID_HEIGHT = 384;

interface RowProps {
  set: IconSet;
  names: string[];
  selected: string | null;
  onPick: (name: string) => void;
  onPreview: (name: string | null) => void;
}

// One row of the grid: COLUMNS icons side by side. The list only renders the rows in view.
const IconRow = ({
  index,
  style,
  ariaAttributes,
  set,
  names,
  selected,
  onPick,
  onPreview,
}: RowComponentProps<RowProps>) => (
  <div style={style} className="grid grid-cols-8 p-1 pb-0" {...ariaAttributes}>
    {names.slice(index * COLUMNS, (index + 1) * COLUMNS).map((name) => (
      <div key={name} className="h-14 p-0.5">
        <button
          type="button"
          {...{ [GRID_ITEM_ATTRIBUTE]: "" }}
          title={readableIconName(name)}
          aria-label={readableIconName(name)}
          aria-pressed={name === selected}
          onClick={() => onPick(name)}
          onMouseEnter={() => onPreview(name)}
          onMouseLeave={() => onPreview(null)}
          onFocus={() => onPreview(name)}
          onBlur={() => onPreview(null)}
          className={cn(
            "flex h-full w-full cursor-pointer items-center justify-center rounded-md border border-transparent text-foreground outline-none transition-colors",
            "hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            name === selected && "border-primary bg-primary/10 text-primary"
          )}
        >
          <IconSvg set={set} name={name} size={28} />
        </button>
      </div>
    ))}
  </div>
);

interface IconPickerProps {
  value: PickedIcon;
  onChange: (icon: PickedIcon) => void;
  // The button that opens the picker.
  children: React.ReactNode;
}

// A dialog to pick an icon from any of the icon libraries: switch the library (and, for those
// that have them, the style), search by name, click an icon.
export const IconPicker: React.FC<IconPickerProps> = ({ value, onChange, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Pick an icon</DialogTitle>
          <DialogDescription>Choose a library, then search by name.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so it starts from the current icon every time. */}
        <IconPickerBody
          value={value}
          onPick={(icon) => {
            onChange(icon);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
};

const IconPickerBody = ({
  value,
  onPick,
}: {
  value: PickedIcon;
  onPick: (icon: PickedIcon) => void;
}) => {
  const [libraryId, setLibraryId] = useState<IconLibrary>(value.library);
  const library = iconLibraryInfo(libraryId);
  // The style of the current icon when it is of this library, else the library's first one.
  const [variantId, setVariantId] = useState(
    () => iconVariant(iconLibraryInfo(value.library), value.name)?.id
  );
  const [search, setSearch] = useState("");
  // The icon under the pointer or focus, named in the footer.
  const [previewed, setPreviewed] = useState<string | null>(null);
  const set = useIconSet(libraryId);

  const activeVariant = library.variants?.find((variant) => variant.id === variantId)
    ? variantId
    : library.variants?.[0].id;

  const names = useMemo(() => {
    if (!set) return [];
    const words = search.toLowerCase().split(/[\s-]+/).filter(Boolean);
    return iconNames(set).filter(
      (name) =>
        (!library.variants || iconVariant(library, name)?.id === activeVariant) &&
        words.every((word) => name.includes(word))
    );
  }, [set, library, activeVariant, search]);

  const selected = value.library === libraryId ? value.name : null;
  // Stable, so a cell only redraws when what it shows changes, not when the footer does.
  const pick = useCallback(
    (name: string) => onPick({ library: libraryId, name }),
    [onPick, libraryId]
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 py-4" onKeyDown={handleGridKeyDown}>
      <SegmentedControl
        aria-label="Icon library"
        value={libraryId}
        onValueChange={setLibraryId}
        options={ICON_LIBRARIES.map(({ id, label }) => ({ value: id, label }))}
        className="self-start"
      />
      <p className="-mt-1 text-xs text-muted-foreground">{library.description}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${library.label} icons...`}
            aria-label="Search icons"
            className="pl-8"
          />
        </div>
        {library.variants && activeVariant && (
          <SegmentedControl
            aria-label="Icon style"
            value={activeVariant}
            onValueChange={setVariantId}
            options={library.variants.map(({ id, label }) => ({ value: id, label }))}
          />
        )}
      </div>

      <div style={{ height: GRID_HEIGHT }} className="rounded-md border">
        {!set ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : names.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No icons match "{search.trim()}".
          </p>
        ) : (
          <List
            // A new search or library starts at the top.
            key={`${libraryId}/${activeVariant}/${search}`}
            rowComponent={IconRow}
            rowProps={{ set, names, selected, onPick: pick, onPreview: setPreviewed }}
            rowCount={Math.ceil(names.length / COLUMNS)}
            rowHeight={ROW_HEIGHT}
            style={{ height: GRID_HEIGHT }}
            aria-label={`${library.label} icons`}
          />
        )}
      </div>

      <p className="flex h-5 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {previewed ? readableIconName(previewed) : ""}
        </span>
        <span className="shrink-0 tabular-nums">
          {set ? `${names.length.toLocaleString()} icons` : ""}
        </span>
      </p>
    </div>
  );
};
