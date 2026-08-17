"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Fades + lifts a section in once it's ~15% into the viewport, then leaves it
// alone — no re-triggering on scroll-back, no animation at all for visitors
// with prefers-reduced-motion (handled in CSS below, not here, so content is
// never hidden behind JS that might not run).
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-safe:duration-deliberate motion-safe:transition-all motion-safe:ease-out ${
        visible ? "opacity-100" : "motion-safe:translate-y-6 motion-safe:opacity-0"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
