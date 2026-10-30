import { cn } from "@/lib/utils";

export function PlateMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <circle cx="16" cy="16" r="15" className="fill-plate-yellow" />
      <circle
        cx="16"
        cy="16"
        r="10.5"
        fill="none"
        strokeWidth="1.5"
        className="stroke-plate-yellow-foreground/45"
      />
      <circle cx="16" cy="16" r="3.5" className="fill-rubber" />
    </svg>
  );
}
