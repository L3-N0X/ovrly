import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PrismaElement } from '@/lib/types';

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
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const newImage = await response.json();
        handleImageChange(element.id, newImage.url);
      } else {
        console.error('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <Label>Image: {element.name}</Label>
      <div className="flex items-center space-x-2">
        <img src={element.image?.src || ''} alt={element.name} className="w-14 h-14 object-cover rounded-md bg-secondary" />
        <Button onClick={handleButtonClick} variant="secondary" className="flex-grow">
          Choose & Upload Image
        </Button>
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
