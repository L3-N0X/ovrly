import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PrismaElement } from "@/lib/types";
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        const newImage = await response.json();
        handleImageChange(element.id, newImage.url);
      } else {
        console.error("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`count-${element.id}`} className="text-sm font-medium">
        Image:
        <span className="font-normal">{element.name}</span>
      </Label>
      <div className="flex items-center space-x-2">
        {(element.image?.src && (
          <img
            src={element.image?.src || ""}
            alt={element.name}
            className="w-15 h-15 object-cover rounded-md bg-secondary"
          />
        )) || (
          <div className="w-15 h-15 rounded-md bg-secondary flex items-center justify-center">
            <Image className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex flex-col flex-1 min-w-0 mr-0">
          <p className="text-sm text-muted-foreground mb-1 h-5 truncate overflow-hidden whitespace-nowrap">
            {element.image?.src.replace(/^.*[\\/]/, "").substring(24) || "No image uploaded"}
          </p>
          <Button onClick={handleButtonClick} variant="secondary" className="flex-grow">
            {element.image?.src ? "Change Image" : "Upload Image"}
          </Button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
      </div>
    </div>
  );
};

export default ImageControl;
