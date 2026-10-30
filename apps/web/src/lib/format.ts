export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(cents / 100);
}

export function formatTerm(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export function formatVisits(limit: number | null): string {
  if (limit === null) return "Unlimited";
  return limit === 1 ? "1 visit" : `${limit} visits`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function todayLocal(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatTime(isoInstant: string): string {
  return new Date(isoInstant).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatPeriod(startsOn: string, endsOn: string): string {
  return `${formatDate(startsOn)} – ${formatDate(endsOn)}`;
}

export function formatDateTime(isoInstant: string): string {
  const instant = new Date(isoInstant);
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return `${formatDate(day)}, ${formatTime(isoInstant)}`;
}
