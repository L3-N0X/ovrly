import { type PrismaElement } from "@/lib/types";

// Rendered outside the app's React tree and theme, hence the inline styles.
export const DragPreview = ({ element }: { element: PrismaElement }) => {
  return (
    <div
      style={{
        backgroundColor: "#18181b",
        color: "white",
        padding: "6px 10px",
        borderRadius: "0.375rem",
        border: "1px solid #3f3f46",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        maxWidth: "240px",
        fontSize: "0.875rem",
        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)",
      }}
    >
      <span
        style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {element.name}
      </span>
      <span
        style={{
          fontSize: "0.625rem",
          color: "#a1a1aa",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {element.type}
      </span>
    </div>
  );
};
