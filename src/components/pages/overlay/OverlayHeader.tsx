import { Button } from "@/components/ui/button";
import type { PrismaOverlay } from "@/lib/types";
import { Check, ChevronLeft, Copy, Edit, Share2 } from "lucide-react";
import { useState } from "react";
import EditOverlayModal from "./EditOverlayModal";

interface OverlayHeaderProps {
  overlay: PrismaOverlay;
  id: string;
  onShare: () => void;
  onBack: () => void;
  onOverlayUpdate?: (updatedOverlay: PrismaOverlay) => void;
}

const OverlayHeader: React.FC<OverlayHeaderProps> = ({
  overlay,
  id,
  onShare,
  onBack,
  onOverlayUpdate,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const publicUrl = `${window.location.origin}/public/overlay/${id}`;

  const handleCopyToClipboard = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleEditSave = async (name: string, description: string) => {
    if (!onOverlayUpdate) return;

    setIsSaving(true);
    try {
      const updatedOverlay = {
        ...overlay,
        name,
        description: description || null,
      };

      // Update the overlay via API
      const response = await fetch(`/api/overlays/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || null,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update overlay");
      }

      // Update the local state immediately for better UX
      onOverlayUpdate(updatedOverlay);
    } catch (error) {
      console.error("Failed to update overlay:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mb-8">
      <div className="flex md:items-center items-start gap-4 md:flex-row flex-col">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-md cursor-pointer text-muted-foreground hover:text-foreground transition h-10 w-10 flex items-center justify-center"
          >
            <ChevronLeft strokeWidth={4} size="32" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold tracking-tighter leading-tight md:leading-tighter">
              {overlay.name}
            </h1>
            <p
              className="text-md text-muted-foreground"
              style={{
                display: overlay.description ? "initial" : "none",
              }}
            >
              {overlay.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <Button onClick={() => setIsEditModalOpen(true)} variant="outline">
            <Edit className="mr-2" />
            Edit Name
          </Button>
          <Button onClick={handleCopyToClipboard} variant="outline">
            {isCopied ? <Check className="mr-2 text-green-300" /> : <Copy className="mr-2" />}
            {isCopied ? "Copied!" : "Copy for OBS"}
          </Button>
          <Button onClick={onShare} variant="outline">
            <Share2 className="mr-2" />
            Share
          </Button>
        </div>
      </div>

      <EditOverlayModal
        overlay={overlay}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditSave}
        isLoading={isSaving}
      />
    </div>
  );
};

export default OverlayHeader;
