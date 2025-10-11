import { useEffect } from "react";
import { loadFont } from "@/lib/fonts";

interface FontLoaderProps {
  fontFamily?: string;
  fontWeight?: string;
}

const FontLoader: React.FC<FontLoaderProps> = ({ fontFamily, fontWeight }) => {
  useEffect(() => {
    if (fontFamily) {
      loadFont(fontFamily, fontWeight || "400").catch((error) => {
        console.error(`Failed to load font: ${fontFamily}`, error);
      });
    }
  }, [fontFamily, fontWeight]);

  return null;
};

export default FontLoader;
