import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PrismaOverlay } from "@/lib/types";

interface OverlayHeaderProps {
  overlay: PrismaOverlay;
  id: string;
  onShare: () => void;
}

const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay, id, onShare }) => {
  const publicUrl = `${window.location.origin}/public/overlay/${id}`;

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
  };

  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold tracking-tighter leading-tight md:leading-tighter mb-2">
        {overlay.name}
      </h1>
      <p className="text-lg text-gray-500 mb-4">{overlay.description}</p>
      <div className="flex items-center gap-2">
        <Input type="text" readOnly value={publicUrl} className="w-full max-w-md" />
        <Button onClick={handleCopyToClipboard}>Copy</Button>
        <Button onClick={onShare} variant="outline">Share</Button>
      </div>
    </div>
  );
};

export default OverlayHeader;
