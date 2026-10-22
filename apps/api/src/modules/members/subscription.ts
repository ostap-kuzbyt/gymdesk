import { isCalendarDate } from "@gymdesk/shared";
import { DomainError } from "../../platform/errors.js";

export type SubscriptionStatus = "upcoming" | "active" | "expired" | "cancelled";

export interface Subscription {
  id: string;
  tariffId: string;
  startsOn: string;
  endsOn: string;
  priceCents: number;
  visitLimit: number | null;
  cancelledOn: string | null;
}

export interface SubscriptionOffer {
  tariffId: string;
  startsOn: string;
  endsOn: string;
  priceCents: number;
  visitLimit: number | null;
}

export function statusOn(subscription: Subscription, date: string): SubscriptionStatus {
  if (subscription.cancelledOn !== null) return "cancelled";
  if (date < subscription.startsOn) return "upcoming";
  if (date > subscription.endsOn) return "expired";
  return "active";
}

export function overlaps(
  a: Pick<Subscription, "startsOn" | "endsOn">,
  b: Pick<Subscription, "startsOn" | "endsOn">,
): boolean {
  return a.startsOn <= b.endsOn && b.startsOn <= a.endsOn;
}

export function assertValidOffer(offer: SubscriptionOffer): void {
  if (!isCalendarDate(offer.startsOn) || !isCalendarDate(offer.endsOn)) {
    throw new DomainError("Subscription dates must be real dates as YYYY-MM-DD");
  }
  if (offer.startsOn > offer.endsOn) {
    throw new DomainError("Subscription cannot end before it starts");
  }
  if (!Number.isInteger(offer.priceCents) || offer.priceCents < 0) {
    throw new DomainError("Subscription price must be a non-negative number of cents");
  }
  if (offer.visitLimit !== null && (!Number.isInteger(offer.visitLimit) || offer.visitLimit < 1)) {
    throw new DomainError("Visit limit must be at least 1, or empty for unlimited visits");
  }
}
