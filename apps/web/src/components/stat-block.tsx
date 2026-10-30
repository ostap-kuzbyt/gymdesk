import { cn } from "@/lib/utils";

const STRIPES = {
  green: "border-l-plate-green",
  blue: "border-l-plate-blue",
  yellow: "border-l-plate-yellow",
  red: "border-l-plate-red",
  neutral: "border-l-foreground",
} as const;

interface StatBlockProps {
  label: string;
  value: string;
  note?: string | undefined;
  tone?: keyof typeof STRIPES;
  compact?: boolean;
}

export function StatBlock({ label, value, note, tone = "neutral", compact }: StatBlockProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-l-8 border-border bg-card px-5 py-4",
        STRIPES[tone],
      )}
    >
      <span
        className={cn("font-stamp leading-none tabular-nums", compact ? "text-5xl" : "text-6xl")}
      >
        {value}
      </span>
      <span className="font-medium">{label}</span>
      {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
    </div>
  );
}
