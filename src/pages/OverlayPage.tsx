import React, { useEffect, useMemo, useRef, useState } from "react";
import { BingoDataProvider } from "@/lib/hooks/useBingoData";
import FontLoader from "@/components/FontLoader";
import type { PrismaOverlay, BaseElementStyle } from "@/lib/types";
import { useOverlayData } from "@/lib/hooks/useOverlayData";
import { ElementListEditor } from "@/components/overlay/editor/elementlist/ElementListEditor";
import OverlayHeader from "@/components/pages/overlay/OverlayHeader";
import EditorCanvas from "@/components/pages/overlay/EditorCanvas";
import Inspector from "@/components/pages/overlay/Inspector";
import type { ContentHandlers } from "@/components/pages/overlay/controls/ElementContentControl";
import type { EditorSelection } from "@/components/pages/overlay/editorSelection";
import { ShareOverlayModal } from "@/components/pages/overlay/ShareOverlayModal";

const OverlayPage: React.FC = () => {
  const {
    id,
    overlay,
    isLoading,
    error,
    handleOverlayChange,
    handleStructureChange,
    handleCounterChange,
    handleImmediateCounterChange,
    handleTitleChange,
    handleImageChange,
    handleBingoDataChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerUpdate,
    handleTimerAddTime,
    handleDeleteOverlay,
  } = useOverlayData();
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  // Shared by the canvas, the layers panel and the inspector.
  const [selectedId, setSelectedId] = useState<EditorSelection>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  const content = useMemo<ContentHandlers>(
    () => ({
      onCounterChange: handleCounterChange,
      onImmediateCounterChange: handleImmediateCounterChange,
      onTitleChange: handleTitleChange,
      onImageChange: handleImageChange,
      onBingoDataChange: handleBingoDataChange,
      onTimerToggle: handleTimerToggle,
      onTimerReset: handleTimerReset,
      onTimerUpdate: handleTimerUpdate,
      onTimerAddTime: handleTimerAddTime,
    }),
    [
      handleCounterChange,
      handleImmediateCounterChange,
      handleTitleChange,
      handleImageChange,
      handleBingoDataChange,
      handleTimerToggle,
      handleTimerReset,
      handleTimerUpdate,
      handleTimerAddTime,
    ]
  );

  // Each selection starts at the top of its settings.
  useEffect(() => {
    inspectorRef.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  const handleToggleShareModal = () => {
    setShareModalOpen(!isShareModalOpen);
  };

  const loadOverlayFonts = (overlayData: PrismaOverlay | null) => {
    if (!overlayData) return null;

    const fonts = new Set<string>();

    if (overlayData.elements) {
      overlayData.elements.forEach((element) => {
        if (element.style) {
          const elementStyle = element.style as BaseElementStyle;
          if (elementStyle.fontFamily) {
            const fontWeight = (elementStyle as { fontWeight?: string }).fontWeight || "400";
            fonts.add(`${elementStyle.fontFamily}:${fontWeight}`);
          }
        }
      });
    }

    return Array.from(fonts).map((fontString) => {
      const [fontFamily, fontWeight] = fontString.split(":");
      return <FontLoader key={fontString} fontFamily={fontFamily} fontWeight={fontWeight} />;
    });
  };

  if (isLoading)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-destructive">{error}</div>
    );
  if (!overlay || !id)
    return <div className="flex items-center justify-center min-h-screen">Overlay not found</div>;

  return (
    <BingoDataProvider onBingoDataChange={handleBingoDataChange}>
      {loadOverlayFonts(overlay)}
      {/* Full screen on large displays, with each panel scrolling on its own. Smaller screens
          stack canvas, inspector and layers and scroll as a whole. */}
      <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
        <OverlayHeader
          overlay={overlay}
          id={id}
          onShare={handleToggleShareModal}
          onOverlayUpdate={handleOverlayChange}
          onDelete={handleDeleteOverlay}
        />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside
            aria-label="Layers"
            className="order-3 shrink-0 border-t bg-background lg:order-1 lg:w-64 lg:overflow-y-auto lg:border-t-0 lg:border-r"
          >
            <ElementListEditor
              overlay={overlay}
              onOverlayChange={handleOverlayChange}
              onStructureChange={handleStructureChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </aside>
          <main className="order-1 h-[55vh] shrink-0 lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1 lg:shrink">
            <EditorCanvas
              overlay={overlay}
              onOverlayChange={handleOverlayChange}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </main>
          <aside
            ref={inspectorRef}
            aria-label="Inspector"
            className="order-2 shrink-0 border-t bg-background lg:order-3 lg:w-[340px] lg:overflow-y-auto lg:border-t-0 lg:border-l xl:w-[360px]"
          >
            <Inspector
              overlay={overlay}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOverlayChange={handleOverlayChange}
              onStructureChange={handleStructureChange}
              content={content}
            />
          </aside>
        </div>
      </div>
      <ShareOverlayModal
        overlayId={id}
        isOpen={isShareModalOpen}
        onClose={handleToggleShareModal}
      />
    </BingoDataProvider>
  );
};

export default OverlayPage;
