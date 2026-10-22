import { useId } from "react";
import { cn } from "@/lib/utils";

export function PlateMark({ className }: { className?: string }) {
  const gradient = useId();

  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id={gradient} x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="var(--teal)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${gradient})`} />
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        strokeWidth="1.5"
        stroke="var(--card)"
        strokeOpacity="0.55"
      />
      <circle cx="16" cy="16" r="3.5" fill="var(--card)" />
    </svg>
  );
}
