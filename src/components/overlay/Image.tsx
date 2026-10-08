import React from 'react';
import type { PrismaElement, ImageStyle } from '@/lib/types';
import { useElementResize } from './useElementResize';

const MIN_IMAGE_SIZE = 8;

interface ImageProps {
  element: PrismaElement;
}

const Image: React.FC<ImageProps> = ({ element }) => {
  const { image, style } = element;
  const imageStyle = style as ImageStyle | null;
  const { dragSize, handle } = useElementResize(element, MIN_IMAGE_SIZE);

  const hasImage = !!image?.src;
  // Without a stored size an image is drawn at its own, and the placeholder at 100 pixels.
  const width = dragSize?.width ?? imageStyle?.width ?? (hasImage ? undefined : 100);
  const height = dragSize?.height ?? imageStyle?.height ?? (hasImage ? undefined : 100);

  return (
    <div
      style={{
        position: 'relative',
        width: width !== undefined ? `${width}px` : undefined,
        height: height !== undefined ? `${height}px` : undefined,
        flexShrink: 0,
      }}
    >
      {hasImage ? (
        <img
          src={image.src}
          alt={element.name}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: imageStyle?.objectFit || 'cover',
            imageRendering: imageStyle?.imageRendering || 'auto',
            borderRadius: imageStyle?.borderRadius ? `${imageStyle.borderRadius}px` : '0px',
          }}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          border: '2px dashed #ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: '14px',
          borderRadius: imageStyle?.borderRadius || 0,
        }}>
          No Image
        </div>
      )}
      {handle}
    </div>
  );
};

export default Image;
