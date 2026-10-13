import { type PrismaElement } from "@/lib/types";

// Rendered outside the app's React tree (into a container on <body>), hence the inline styles;
// the theme's variables still reach it.
export const DragPreview = ({ element }: { element: PrismaElement }) => {
  return (
    <div
      style={{
        backgroundColor: "var(--popover)",
        color: "var(--popover-foreground)",
        padding: "6px 10px",
        borderRadius: "0.375rem",
        border: "1px solid var(--border)",
        display: "flex",
        gap: "8px",
        alignItems: "center",
        maxWidth: "240px",
        fontSize: "0.875rem",
        boxShadow: "var(--shadow-lg)",
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
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {element.type}
      </span>
    </div>
  );
};
