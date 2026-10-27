import type { SubscriptionView, TariffView } from "@gymdesk/shared";
import { addDays } from "@/lib/dates";

type Range = Pick<SubscriptionView, "startsOn" | "endsOn" | "cancelledOn">;

export function suggestedStart(subscriptions: Range[], today: string): string {
  const lastEnd = subscriptions
    .filter((subscription) => subscription.cancelledOn === null && subscription.endsOn >= today)
    .map((subscription) => subscription.endsOn)
    .sort()
    .at(-1);
  return lastEnd ? addDays(lastEnd, 1) : today;
}

export function endsOn(tariff: Pick<TariffView, "durationDays">, startsOn: string): string {
  return addDays(startsOn, tariff.durationDays - 1);
}

export function findOverlap(
  subscriptions: Range[],
  startsOn: string,
  endsOnDate: string,
): Range | undefined {
  return subscriptions.find(
    (subscription) =>
      subscription.cancelledOn === null &&
      subscription.startsOn <= endsOnDate &&
      startsOn <= subscription.endsOn,
  );
}
