import type { LoadRow } from "@gymdesk/shared";
import { addDays, daysBetween } from "@/lib/dates";

export type ReportTab = "attendance" | "revenue" | "load";
export type RangePreset = "14d" | "30d" | "month" | "6m" | "year";

export interface DateRange {
  from: string;
  to: string;
}

export function presetRange(preset: RangePreset, today: string): DateRange {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  switch (preset) {
    case "14d":
      return { from: addDays(today, -13), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "6m": {
      const total = year * 12 + (month - 1) - 5;
      const startYear = Math.floor(total / 12);
      const startMonth = (total % 12) + 1;
      return { from: `${startYear}-${String(startMonth).padStart(2, "0")}-01`, to: today };
    }
    case "year":
      return { from: `${year}-01-01`, to: today };
  }
}

export const DEFAULT_PRESET: Record<ReportTab, RangePreset> = {
  attendance: "30d",
  revenue: "6m",
  load: "14d",
};

export function periodLabel(period: string): string {
  if (period.length === 4) return period;
  const date = new Date(`${period}-01T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function hoursOf(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function daysIn(range: DateRange): string[] {
  const count = daysBetween(range.from, range.to);
  return Array.from({ length: Math.max(count, 0) + 1 }, (_, index) => addDays(range.from, index));
}

export interface SeriesPoint {
  date: string;
  [seriesId: string]: number | string;
}

export function pivotHours(
  rows: LoadRow[],
  range: DateRange,
): { points: SeriesPoint[]; series: { id: string; name: string }[] } {
  const series = [...new Map(rows.map((row) => [row.id, row.name])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const points = daysIn(range).map((date) => {
    const point: SeriesPoint = { date };
    for (const item of series) point[item.id] = 0;
    for (const row of rows) if (row.date === date) point[row.id] = hoursOf(row.minutes);
    return point;
  });
  return { points, series };
}

export function pivotBookings(
  rows: LoadRow[],
  range: DateRange,
): { date: string; booked: number; capacity: number }[] {
  return daysIn(range).map((date) => {
    const day = rows.filter((row) => row.date === date);
    return {
      date,
      booked: day.reduce((sum, row) => sum + row.reserved, 0),
      capacity: day.reduce((sum, row) => sum + row.capacity, 0),
    };
  });
}

export interface LoadTotals {
  id: string;
  name: string;
  workouts: number;
  minutes: number;
  reserved: number;
  capacity: number;
}

export function totalsOf(rows: LoadRow[]): LoadTotals[] {
  const totals = new Map<string, LoadTotals>();
  for (const row of rows) {
    const current = totals.get(row.id) ?? {
      id: row.id,
      name: row.name,
      workouts: 0,
      minutes: 0,
      reserved: 0,
      capacity: 0,
    };
    current.workouts += row.workouts;
    current.minutes += row.minutes;
    current.reserved += row.reserved;
    current.capacity += row.capacity;
    totals.set(row.id, current);
  }
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));
}

export function fillPercent(reserved: number, capacity: number): number {
  return capacity === 0 ? 0 : Math.round((reserved / capacity) * 100);
}
