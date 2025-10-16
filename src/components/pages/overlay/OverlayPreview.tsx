import React, { useState, useRef, useCallback, useEffect } from "react";
import OverlayCanvas from "@/components/overlay/OverlayCanvas";
import type { PrismaOverlay } from "@/lib/types";

interface OverlayPreviewProps {
  overlay: PrismaOverlay;
}

const OverlayPreview: React.FC<OverlayPreviewProps> = ({ overlay }) => {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const calculateScale = useCallback(() => {
    if (previewContainerRef.current) {
      const { width } = previewContainerRef.current.getBoundingClientRect();
      setScale(width / 800);
    }
  }, []);

  useEffect(() => {
    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, [calculateScale, overlay]);

  return (
    <div
      ref={previewContainerRef}
      className="flex flex-col items-center border rounded-lg bg-secondary pt-4 md:sticky top-20"
    >
      <h2 className="text-xl font-semibold mb-2 w-full px-4">Preview</h2>
      <div className="aspect-[4/3] w-full max-w-full overflow-hidden flex justify-center items-center bg-black dark:bg-black">
        <div
          style={{
            width: "800px",
            height: "600px",
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <OverlayCanvas overlay={overlay} />
        </div>
      </div>
      <div className="py-2 text-sm text-muted-foreground mb-4">Live Preview (800x600)</div>
    </div>
  );
};

export default OverlayPreview;
