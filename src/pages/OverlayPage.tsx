import React, { useState } from "react";
import StyleEditor from "@/components/overlay/editor/StyleEditor";
import FontLoader from "@/components/FontLoader";
import type { PrismaOverlay, BaseElementStyle } from "@/lib/types";
import { useOverlayData } from "@/lib/hooks/useOverlayData";
import OverlayHeader from "@/components/pages/overlay/OverlayHeader";
import OverlayPreview from "@/components/pages/overlay/OverlayPreview";
import DataControls from "@/components/pages/overlay/DataControls";
import DangerZone from "@/components/pages/overlay/DangerZone";
import { ShareOverlayModal } from "@/components/pages/overlay/ShareOverlayModal";

const OverlayPage: React.FC = () => {
  const {
    id,
    overlay,
    isLoading,
    error,
    handleOverlayChange,
    handleCounterChange,
    handleTitleChange,
    handleImageChange,
    handleTimerToggle,
    handleTimerReset,
    handleTimerUpdate,
    handleTimerAddTime,
    handleDeleteOverlay,
    selectedTimer,
    setSelectedTimer,
  } = useOverlayData();
  const [isShareModalOpen, setShareModalOpen] = useState(false);

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

    return Array.from(fonts).map((fontString, index) => {
      const [fontFamily, fontWeight] = fontString.split(":");
      return <FontLoader key={index} fontFamily={fontFamily} fontWeight={fontWeight} />;
    });
  };

  if (isLoading)
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">{error}</div>
    );
  if (!overlay || !id)
    return <div className="flex items-center justify-center min-h-screen">Overlay not found</div>;

  return (
    <>
      {loadOverlayFonts(overlay)}
      <div className="container mx-auto">
        <OverlayHeader overlay={overlay} id={id} onShare={handleToggleShareModal} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <OverlayPreview overlay={overlay} />

          <div className="space-y-8 pb-96">
            <DataControls
              overlay={overlay}
              handleCounterChange={handleCounterChange}
              handleTitleChange={handleTitleChange}
              handleImageChange={handleImageChange}
              handleTimerToggle={handleTimerToggle}
              handleTimerReset={handleTimerReset}
              handleTimerUpdate={handleTimerUpdate}
              handleTimerAddTime={handleTimerAddTime}
              selectedTimer={selectedTimer}
              setSelectedTimer={setSelectedTimer}
            />

            <StyleEditor overlay={overlay} onOverlayChange={handleOverlayChange} />

            <DangerZone handleDeleteOverlay={handleDeleteOverlay} />
          </div>
        </div>
      </div>
      <ShareOverlayModal overlayId={id} isOpen={isShareModalOpen} onClose={handleToggleShareModal} />
    </>
  );
};

export default OverlayPage;
