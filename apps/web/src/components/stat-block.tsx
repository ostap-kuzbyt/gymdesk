import { cn } from "@/lib/utils";

const TONES = {
  green: { card: "to-plate-green-soft", value: "text-plate-green", glow: "before:bg-plate-green" },
  blue: { card: "to-plate-blue-soft", value: "text-plate-blue", glow: "before:bg-plate-blue" },
  yellow: { card: "to-plate-yellow-soft", value: "text-foreground", glow: "before:bg-orange" },
  red: { card: "to-plate-red-soft", value: "text-plate-red", glow: "before:bg-plate-red" },
  neutral: { card: "to-secondary", value: "text-foreground", glow: "before:bg-teal" },
} as const;

interface StatBlockProps {
  label: string;
  value: string;
  note?: string | undefined;
  tone?: keyof typeof TONES;
  compact?: boolean;
}

export function StatBlock({ label, value, note, tone = "neutral", compact }: StatBlockProps) {
  const style = TONES[tone];
  return (
    <div
      className={cn(
        "surface relative flex flex-col gap-1.5 overflow-hidden bg-gradient-to-br from-card px-4 py-3 sm:gap-2 sm:px-5 sm:py-4",
        "before:absolute before:-top-10 before:-right-10 before:size-36 before:rounded-full before:opacity-25 before:blur-2xl before:content-['']",
        style.card,
        style.glow,
      )}
    >
      <span
        className={cn(
          "relative font-stamp leading-none tabular-nums",
          compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl",
          style.value,
        )}
      >
        {value}
      </span>
      <span className="relative font-medium">{label}</span>
      {note ? <span className="relative text-sm text-muted-foreground">{note}</span> : null}
    </div>
  );
}
