import React from 'react';
import type { PrismaElement, ImageStyle } from '@/lib/types';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ImageStyleEditorProps {
  element: PrismaElement;
  onStyleChange: (style: ImageStyle) => void;
}

const ImageStyleEditor: React.FC<ImageStyleEditorProps> = ({ element, onStyleChange }) => {
  const style = (element.style || {}) as ImageStyle;

  const handleValueChange = (key: keyof ImageStyle, value: ImageStyle[keyof ImageStyle]) => {
    onStyleChange({ ...style, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Width: {style.width || 0}px</Label>
        <Slider
          value={[style.width || 100]}
          onValueChange={([val]) => handleValueChange('width', val)}
          max={800}
          step={1}
        />
      </div>
      <div>
        <Label>Height: {style.height || 0}px</Label>
        <Slider
          value={[style.height || 100]}
          onValueChange={([val]) => handleValueChange('height', val)}
          max={600}
          step={1}
        />
      </div>
      <div>
        <Label>Border Radius: {style.borderRadius || 0}px</Label>
        <Slider
          value={[style.borderRadius || 0]}
          onValueChange={([val]) => handleValueChange('borderRadius', val)}
          max={100}
          step={1}
        />
      </div>
      <div>
        <Label>Object Fit</Label>
        <Select
          value={style.objectFit || 'cover'}
          onValueChange={(value) => handleValueChange('objectFit', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Image Rendering</Label>
        <Select
          value={style.imageRendering || 'auto'}
          onValueChange={(value) => handleValueChange('imageRendering', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="pixelated">Pixelated</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default ImageStyleEditor;
