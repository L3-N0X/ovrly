import { type PrismaElement } from "@/lib/types";
import { GripVertical } from "lucide-react";

export const DragPreview = ({ element }: { element: PrismaElement }) => {
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        color: "white",
        padding: "12px",
        borderRadius: "0.375rem",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        width: "350px",
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
      }}
    >
      <GripVertical color="#a1a1aa" />
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: "500", fontSize: "1rem" }}>{element.name}</span>
        <span
          style={{
            fontSize: "0.75rem",
            color: "#a1a1aa",
            backgroundColor: "#27272a",
            padding: "2px 8px",
            borderRadius: "9999px",
            textTransform: "uppercase",
            fontWeight: "bold",
          }}
        >
          {element.type}
        </span>
      </div>
    </div>
  );
};
