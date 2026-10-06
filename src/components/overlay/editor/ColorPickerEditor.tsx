import { Sketch, type ColorResult } from "@uiw/react-color";

export const ColorPickerEditor = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  return (
    <Sketch
      color={value || "#fff"}
      onChange={(newColor: ColorResult) => {
        onChange(newColor.hexa);
      }}
    />
  );
};
