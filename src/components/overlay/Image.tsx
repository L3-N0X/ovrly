import React, { useState } from 'react';
import type { PrismaElement, ImageStyle } from '@/lib/types';
import { useCanvasEditing } from './canvasEditing';
import { useFill } from './fill';
import { useElementResize } from './useElementResize';

const MIN_IMAGE_SIZE = 8;

interface ImageProps {
  element: PrismaElement;
}

const Image: React.FC<ImageProps> = ({ element }) => {
  const { image, style } = element;
  const imageStyle = style as ImageStyle | null;
  const editing = useCanvasEditing();
  const fill = useFill(element);
  const { dragSize, handle } = useElementResize(element, MIN_IMAGE_SIZE, {
    width: !fill.width,
    height: !fill.height,
  });
  // A link that doesn't load (a bound variable pointing nowhere) is drawn like no image at all,
  // rather than as the browser's broken image.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const hasImage = !!image?.src && image.src !== failedSrc;
  // Without a stored size an image is drawn at its own, and an empty one at 100 pixels.
  const width = dragSize?.width ?? imageStyle?.width ?? (hasImage ? undefined : 100);
  const height = dragSize?.height ?? imageStyle?.height ?? (hasImage ? undefined : 100);

  return (
    <div
      style={{
        position: 'relative',
        width: width !== undefined ? `${width}px` : undefined,
        height: height !== undefined ? `${height}px` : undefined,
        flexShrink: 0,
        ...fill.style,
      }}
      // Without an image there is nothing to draw, so it keeps its place in the layout but stays
      // empty. The editor outlines it, so it can still be found and picked.
      className={
        !hasImage && editing ? 'outline-1 -outline-offset-1 outline-dashed outline-white/40' : undefined
      }
    >
      {hasImage && (
        <img
          src={image.src}
          alt={element.name}
          onError={() => setFailedSrc(image.src)}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: imageStyle?.objectFit || 'cover',
            imageRendering: imageStyle?.imageRendering || 'auto',
            borderRadius: imageStyle?.borderRadius ? `${imageStyle.borderRadius}px` : '0px',
          }}
        />
      )}
      {handle}
    </div>
  );
};

export default Image;
