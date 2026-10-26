const MS_PER_DAY = 86_400_000;

function toUtc(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

export function addDays(isoDate: string, days: number): string {
  return new Date(toUtc(isoDate) + days * MS_PER_DAY).toISOString().slice(0, 10);
}
