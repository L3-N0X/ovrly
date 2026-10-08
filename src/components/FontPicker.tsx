"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Font, FontWeight } from "@/lib/fonts";
import { DEFAULT_FONT_FAMILY, DEFAULT_FONT_WEIGHT, fetchAllFonts, loadFont } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Filter, Search } from "lucide-react";
import * as React from "react";
import { List } from "react-window";
import type { ListImperativeAPI, RowComponentProps } from "react-window";

/** Height of one font row: the family name above its preview word. */
const ROW_HEIGHT = 55;

function FontListItem({
  font,
  weight,
  isSelected,
  onSelect,
  previewWord,
}: {
  font: Font;
  weight: FontWeight;
  isSelected: boolean;
  onSelect: () => void;
  previewWord: string;
}) {
  const [isFontLoaded, setIsFontLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!isFontLoaded) {
      loadFont(font.family, weight)
        .then(() => setIsFontLoaded(true))
        .catch((error) => console.error("Failed to load font:", error));
    }
  }, [isFontLoaded, font.family, weight]);

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={onSelect}
      className="data-[selected=true]:bg-accent flex h-full w-full cursor-pointer items-center gap-2 p-2 text-left"
      data-selected={isSelected}
    >
      <Check className={cn("h-3 w-3 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
      <div className="flex min-w-0 flex-col">
        <span className="text-muted-foreground truncate text-xs font-medium">{font.family}</span>
        <span
          className={cn(
            "truncate text-xl transition-opacity duration-300",
            isFontLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{
            fontFamily: isFontLoaded ? font.family : "system-ui",
            fontWeight: weight,
          }}
        >
          {previewWord}
        </span>
      </div>
    </button>
  );
}

interface FontPickerProps {
  onChange?: (font: Font["family"]) => void;
  /** A family from the catalog. Empty means the element has none stored yet. */
  value?: string;
  id?: string;
  /** The weight the element's text uses, which the previews are drawn at. */
  weight?: FontWeight;
  width?: number;
  height?: number;
  className?: string;
  showFilters?: boolean;
  previewWord?: string;
}

/**
 * Picks a font family out of the Google Fonts catalog plus the custom fonts in
 * public/custom-fonts.json. The list is virtualized, because the catalog runs to thousands of
 * families and a preview loads each one as it is drawn.
 *
 * cmdk is deliberately not used here: it filters and reorders the items it has registered,
 * which is only the handful of rows the virtual list happens to have mounted, so searching
 * and keyboard navigation would fight the list rather than drive it.
 */
export function FontPicker({
  onChange,
  value,
  id,
  weight = DEFAULT_FONT_WEIGHT,
  width,
  height = 300,
  className,
  showFilters = true,
  previewWord = "The quick brown fox",
}: FontPickerProps) {
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [fonts, setFonts] = React.useState<Font[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const listRef = React.useRef<ListImperativeAPI>(null);

  // An element always has a font: the one it picked, or the app default. Resolving it here
  // rather than in each editor is what keeps an element that never chose one from reading
  // "Select font..." while it is in fact already rendering text.
  const selectedFamily = value || DEFAULT_FONT_FAMILY;

  React.useEffect(() => {
    let cancelled = false;

    fetchAllFonts()
      .then((fetchedFonts) => {
        if (cancelled) return;
        setFonts(fetchedFonts);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error("Failed to load fonts"));
        console.error("Error loading fonts:", err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = React.useMemo(
    () => Array.from(new Set(fonts.map((font) => font.category))).sort(),
    [fonts]
  );

  const filteredFonts = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    return fonts.filter((font) => {
      const matchesSearch = !needle || font.family.toLowerCase().includes(needle);
      const matchesCategory =
        !showFilters || selectedCategory === "all" || font.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [fonts, search, selectedCategory, showFilters]);

  const handleSelectFont = React.useCallback(
    (font: Font) => {
      onChange?.(font.family);
      setIsOpen(false);
    },
    [onChange]
  );

  const scrollBy = React.useCallback(
    (direction: 1 | -1) => {
      const index = Math.min(
        Math.max(0, filteredFonts.findIndex((font) => font.family === selectedFamily)),
        filteredFonts.length - 1
      );
      listRef.current?.scrollToRow({ index: index + direction });
    },
    [filteredFonts, selectedFamily]
  );

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      scrollBy(event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      listRef.current?.scrollToRow({ index: event.key === "Home" ? 0 : filteredFonts.length - 1 });
    } else if (event.key === "Escape") {
      setSearch("");
    }
  };

  interface FontRowProps {
    fonts: Font[];
    selectedFamily: string;
    weight: FontWeight;
    onSelect: (font: Font) => void;
    previewWord: string;
  }

  const Row = React.useCallback(
    ({
      index,
      style,
      fonts,
      selectedFamily,
      weight,
      onSelect,
      previewWord,
    }: RowComponentProps<FontRowProps>) => {
      const font = fonts[index];
      return (
        <div style={style}>
          <FontListItem
            font={font}
            weight={weight}
            isSelected={selectedFamily === font.family}
            onSelect={() => onSelect(font)}
            previewWord={previewWord}
          />
        </div>
      );
    },
    []
  );

  const rowProps = React.useMemo(
    () => ({
      fonts: filteredFonts,
      selectedFamily,
      weight,
      onSelect: handleSelectFont,
      previewWord,
    }),
    [filteredFonts, selectedFamily, weight, handleSelectFont, previewWord]
  );

  const showEmpty = !isLoading && !error && filteredFonts.length === 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Select font"
          className={cn("group relative justify-between", className)}
          style={{ width }}
        >
          <span className="truncate">{selectedFamily}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex flex-col overflow-hidden p-0" style={{ width, height }}>
        <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
          <Search className="text-muted-foreground size-4 shrink-0 opacity-50" />
          <Input
            placeholder="Search fonts..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="h-full flex-1 border-none bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3">
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-accent h-7 px-2 text-sm font-normal capitalize"
                >
                  <Filter className="text-muted-foreground h-4 w-4" />
                  {selectedCategory === "all" ? "All Categories" : selectedCategory}
                  <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px]">
                <DropdownMenuRadioGroup value={selectedCategory} onValueChange={setSelectedCategory}>
                  <DropdownMenuRadioItem value="all">All Categories</DropdownMenuRadioItem>
                  {categories.map((category) => (
                    <DropdownMenuRadioItem key={category} value={category} className="capitalize">
                      {category}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="text-muted-foreground text-xs">{filteredFonts.length} fonts</span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-border" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center p-4 text-sm text-destructive">
              Failed to load fonts. Please try again later.
            </div>
          ) : showEmpty ? (
            <div className="flex h-full items-center justify-center p-4 text-sm">
              No fonts found.
            </div>
          ) : (
            <List
              listRef={listRef}
              style={{ height: "100%", width: "100%" }}
              rowComponent={Row}
              rowCount={filteredFonts.length}
              rowHeight={ROW_HEIGHT}
              rowProps={rowProps}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}