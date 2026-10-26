import { cn } from "@/lib/utils";
import type { PlateTone } from "@/lib/plates";

const TONES: Record<PlateTone, string> = {
  green: "bg-plate-green text-plate-green-foreground",
  blue: "bg-plate-blue text-plate-blue-foreground",
  yellow: "bg-plate-yellow text-plate-yellow-foreground",
  red: "bg-plate-red text-plate-red-foreground",
  neutral: "bg-muted text-muted-foreground",
};

const SIZES = {
  sm: "size-7 text-xs",
  md: "size-10 text-base",
  lg: "size-14 text-2xl",
} as const;

interface PlateBadgeProps {
  tone: PlateTone;
  value: string;
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export function PlateBadge({ tone, value, label, size = "md", className }: PlateBadgeProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-grid shrink-0 place-items-center rounded-full leading-none font-stamp",
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-[12%] rounded-full ring-1 ring-current/40 ring-inset"
      />
      <span aria-hidden>{value}</span>
    </span>
  );
}
