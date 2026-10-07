import React from "react";
import { formatVariableValue } from "@/lib/variables";
import type { BaseElementStyle, PrismaElement } from "@/lib/types";
import Title from "./Title";

interface VariableProps {
  variable: NonNullable<PrismaElement["variable"]>;
  style: BaseElementStyle;
}

// Shows a variable another application sends through the public API: as text like a title,
// or as a swatch for colors. The value is kept up to date by the server (services/variables.ts).
const Variable: React.FC<VariableProps> = ({ variable, style }) => {
  if (variable.type === "COLOR" && typeof variable.value === "string") {
    const size = typeof style?.fontSize === "number" ? style.fontSize : 36;
    return (
      <div
        style={{ width: size, height: size, borderRadius: size / 6, backgroundColor: variable.value }}
      />
    );
  }
  return <Title text={formatVariableValue(variable.type, variable.value)} style={style} />;
};

export default Variable;
