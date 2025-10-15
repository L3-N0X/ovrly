import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Copy } from "lucide-react";
import type { PrismaOverlay } from "@/lib/types";

interface OverlayHeaderProps {
  overlay: PrismaOverlay;
  id: string;
}

const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay, id }) => {
  const navigate = useNavigate();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    if (id) {
      const url = `${window.location.origin}/public/${id}`;
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center mb-8">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mr-4">
        <ArrowLeft className="h-6 w-6" />
      </Button>
      <div className="flex-grow">
        <div className="flex items-center space-x-3">
          {overlay.icon && (
            <img
              src={`/presets/icons/${overlay.icon}`}
              alt={`${overlay.name} icon`}
              className="h-6 w-6"
            />
          )}
          <h1 className="text-2xl font-bold">{overlay.name}</h1>
        </div>
        {overlay.description && (
          <p className="text-sm text-muted-foreground">{overlay.description}</p>
        )}
      </div>
      <Button variant="outline" size="lg" onClick={handleCopy}>
        {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        Copy Link
      </Button>
    </div>
  );
};

export default OverlayHeader;
