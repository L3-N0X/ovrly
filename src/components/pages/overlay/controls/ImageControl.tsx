import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { BindableField } from "@/components/variables/BindableField";
import type { PrismaElement } from "@/lib/types";
import { uploadImage } from "@/lib/uploads";
import { Image } from "lucide-react";

interface ImageControlProps {
  element: PrismaElement;
  handleImageChange: (elementId: string, src: string) => void;
}

const ImageControl: React.FC<ImageControlProps> = ({ element, handleImageChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      handleImageChange(element.id, await uploadImage(file));
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <BindableField property="src" label="Image">
      <div className="flex items-center gap-2">
        {element.image?.src ? (
          <img
            src={element.image.src}
            alt={element.name}
            className="size-9 shrink-0 rounded-md bg-secondary object-cover"
          />
        ) : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary">
            <Image className="size-4 text-muted-foreground" />
          </div>
        )}
        <p
          className="min-w-0 flex-1 truncate text-sm text-muted-foreground"
          title={element.image?.src || undefined}
        >
          {element.image?.src.replace(/^.*[\\/]/, "") || "No image uploaded"}
        </p>
        <Button onClick={handleButtonClick} variant="secondary" size="sm" className="shrink-0">
          {element.image?.src ? "Change" : "Upload"}
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
      </div>
    </BindableField>
  );
};

export default ImageControl;
