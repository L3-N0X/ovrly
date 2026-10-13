import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

// Fades and lifts its children in the first time they scroll into view (`.reveal` in
// index.css, which leaves them in place for people who prefer reduced motion).
export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  // Milliseconds, to stagger items that come into view together.
  delay?: number;
}> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-shown={shown}
      className={cn("reveal", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
};

// A card lit by a soft glow that follows the pointer.
export const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    onPointerMove={(event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    }}
    className={cn(
      "spotlight group relative h-full overflow-hidden rounded-2xl border bg-card/60 transition-colors hover:border-primary/30",
      className
    )}
  >
    {children}
  </div>
);
