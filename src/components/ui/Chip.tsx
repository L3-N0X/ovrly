import React from "react";

interface ChipProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Chip({ children, className = "", style }: ChipProps) {
  return (
    <span
      className={`bg-muted relative px-[0.5rem] py-[0.2rem] font-mono text-sm font-semibold inline-block border-border border-2 rounded-full ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
