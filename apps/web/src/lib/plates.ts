import type { SubscriptionView } from "@gymdesk/shared";
import { daysBetween } from "./dates";

export type PlateTone = "green" | "blue" | "yellow" | "red" | "neutral";

export interface PlateSpec {
  tone: PlateTone;
  value: string;
  label: string;
}

export const EXPIRING_SOON_DAYS = 7;

interface PlateInput {
  status: SubscriptionView["status"];
  startsOn: string;
  endsOn: string;
  today: string;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

export function plateFor({ status, startsOn, endsOn, today }: PlateInput): PlateSpec {
  if (status === "cancelled") return { tone: "red", value: "×", label: "Cancelled" };
  if (status === "expired") return { tone: "red", value: "0", label: "Expired" };

  if (status === "upcoming") {
    const days = daysBetween(today, startsOn);
    return { tone: "blue", value: String(days), label: `Starts in ${plural(days, "day")}` };
  }

  const daysLeft = daysBetween(today, endsOn);
  const label = daysLeft === 0 ? "Last day today" : `${plural(daysLeft, "day")} left`;
  return {
    tone: daysLeft <= EXPIRING_SOON_DAYS ? "yellow" : "green",
    value: String(daysLeft),
    label,
  };
}
