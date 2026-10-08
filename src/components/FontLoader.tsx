import { useEffect } from "react";
import { loadFont, type FontWeight } from "@/lib/fonts";

interface FontLoaderProps {
  fontFamily?: string;
  fontWeight?: FontWeight;
}

const FontLoader: React.FC<FontLoaderProps> = ({ fontFamily, fontWeight }) => {
  useEffect(() => {
    if (!fontFamily) return;
    loadFont(fontFamily, fontWeight).catch((error) => {
      console.error(`Failed to load font: ${fontFamily}`, error);
    });
  }, [fontFamily, fontWeight]);

  return null;
};

export default FontLoader;