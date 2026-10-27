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
    <span className="flex items-center gap-2.5">
      <PlateBadge {...plate} size="sm" />
      <span>until {formatDate(activeUntil)}</span>
    </span>
  );
}
