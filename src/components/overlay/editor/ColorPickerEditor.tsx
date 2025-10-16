import { Sketch, type ColorResult } from "@uiw/react-color";
import { useEffect, useState } from "react";

export const ColorPickerEditor = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  const [color, setColor] = useState("#fff");

  useEffect(() => {
    if (value && value !== color) {
      setColor(value);
    }
  }, [value, color]);

  return (
    <Sketch
      color={color}
      onChange={(newColor: ColorResult) => {
        setColor(newColor.hexa);
        onChange(newColor.hexa);
      }}
    />
  );
};
