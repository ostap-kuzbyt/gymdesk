import { PlateBadge } from "@/components/plate-badge";
import { formatDate, todayLocal } from "@/lib/format";
import { plateFor } from "@/lib/plates";

export function ActiveUntil({ activeUntil }: { activeUntil: string | null }) {
  if (activeUntil === null) {
    return <span className="text-muted-foreground">No active subscription</span>;
  }

  const today = todayLocal();
  const plate = plateFor({ status: "active", startsOn: today, endsOn: activeUntil, today });

  return (
    <span className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2.5">
      <PlateBadge {...plate} size="sm" />
      <span className="text-xs sm:text-sm">until {formatDate(activeUntil)}</span>
    </span>
  );
}
