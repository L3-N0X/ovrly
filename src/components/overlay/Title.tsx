import React from "react";
import type { BaseElementStyle } from "@/lib/types";
import { textStyle } from "./textStyle";

interface TitleProps {
  text: string;
  style: BaseElementStyle;
}

const Title: React.FC<TitleProps> = ({ text, style }) => (
  <h1 style={{ ...textStyle(style, 36), whiteSpace: "nowrap" }}>{text}</h1>
);

export default Title;