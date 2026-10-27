import type { SubscriptionView, TariffView } from "@gymdesk/shared";
import { PlateBadge } from "@/components/plate-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/lib/config-context";
import { formatMoney, formatPeriod, formatVisits, todayLocal } from "@/lib/format";
import { plateFor } from "@/lib/plates";

const STATUS_LABELS: Record<SubscriptionView["status"], string> = {
  active: "Active",
  upcoming: "Starts later",
  expired: "Ended",
  cancelled: "Cancelled",
};

export function SubscriptionsTable({
  subscriptions,
  tariffs,
  onCancel,
}: {
  subscriptions: SubscriptionView[];
  tariffs: TariffView[];
  onCancel?: (subscription: SubscriptionView) => void;
}) {
  const currency = useCurrency();
  const today = todayLocal();
  const names = new Map(tariffs.map((tariff) => [tariff.id, tariff.name]));
  const newestFirst = [...subscriptions].sort((a, b) => b.startsOn.localeCompare(a.startsOn));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Tariff</TableHead>
          <TableHead>Period</TableHead>
          <TableHead className="text-right">Paid</TableHead>
          <TableHead>Visits</TableHead>
          {onCancel ? <TableHead className="w-24" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {newestFirst.map((subscription) => {
          const plate = plateFor({ ...subscription, today });
          return (
            <TableRow key={subscription.id}>
              <TableCell>
                <span className="flex items-center gap-2.5">
                  <PlateBadge {...plate} size="sm" />
                  {STATUS_LABELS[subscription.status]}
                </span>
              </TableCell>
              <TableCell className="font-medium">
                {names.get(subscription.tariffId) ?? "Tariff"}
              </TableCell>
              <TableCell>{formatPeriod(subscription.startsOn, subscription.endsOn)}</TableCell>
              <TableCell className="text-right font-stamp tabular-nums">
                {formatMoney(subscription.priceCents, currency)}
              </TableCell>
              <TableCell>{formatVisits(subscription.visitLimit)}</TableCell>
              {onCancel ? (
                <TableCell className="text-right">
                  {subscription.status === "active" || subscription.status === "upcoming" ? (
                    <Button variant="ghost" size="sm" onClick={() => onCancel(subscription)}>
                      Cancel
                    </Button>
                  ) : null}
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
