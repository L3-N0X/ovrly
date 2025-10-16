import React from 'react';
import type { PrismaElement, ImageStyle } from '@/lib/types';

interface ImageProps {
  element: PrismaElement;
}

const Image: React.FC<ImageProps> = ({ element }) => {
  const { image, style } = element;
  const imageStyle = style as ImageStyle | null;

  if (!image || !image.src) {
    return (
      <div style={{
        width: imageStyle?.width || '100px',
        height: imageStyle?.height || '100px',
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
    );
  }

  const styles: React.CSSProperties = {
    width: imageStyle?.width ? `${imageStyle.width}px` : '100%',
    height: imageStyle?.height ? `${imageStyle.height}px` : '100%',
    objectFit: imageStyle?.objectFit || 'cover',
    imageRendering: imageStyle?.imageRendering || 'auto',
    borderRadius: imageStyle?.borderRadius ? `${imageStyle.borderRadius}px` : '0px',
  };

  return <img src={image.src} alt={element.name} style={styles} />;
};

export default Image;
