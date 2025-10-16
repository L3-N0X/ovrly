import { Button } from "@/components/ui/button";
import type { PrismaOverlay } from "@/lib/types";
import { ChevronLeft, Copy, Share2 } from "lucide-react";

interface OverlayHeaderProps {
  overlay: PrismaOverlay;
  id: string;
  onShare: () => void;
  onBack: () => void;
}

const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay, id, onShare, onBack }) => {
  const publicUrl = `${window.location.origin}/public/overlay/${id}`;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  return (
    <div className="mb-8">
      <div className="flex items-center gap-4 mb-2">
        <Button onClick={onBack} variant="ghost" size="icon-lg">
          <ChevronLeft />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-4xl font-bold tracking-tighter leading-tight md:leading-tighter">
            {overlay.name}
          </h1>
          <p
            className="text-lg text-gray-500 mb-4 ml-1o4"
            style={{
              display: overlay.description ? "initial" : "none",
            }}
          >
            {overlay.description}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button onClick={handleCopyToClipboard} variant="outline">
            <Copy className="mr-2" />
            Copy
          </Button>
          <Button onClick={onShare} variant="outline">
            <Share2 className="mr-2" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OverlayHeader;
