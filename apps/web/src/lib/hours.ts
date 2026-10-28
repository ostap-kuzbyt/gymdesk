export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export interface HoursWindow {
  weekday: number;
  from: string;
  to: string;
}

export function weekdayOf(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function dayRuns(days: number[]): string[] {
  const runs: number[][] = [];
  for (const day of [...days].sort((a, b) => a - b)) {
    const last = runs.at(-1);
    if (last && day === (last.at(-1) ?? 0) + 1) last.push(day);
    else runs.push([day]);
  }
  return runs.flatMap((run) => {
    const name = (day: number) => WEEKDAY_SHORT[day - 1] ?? "";
    if (run.length >= 3) return [`${name(run[0] ?? 1)}–${name(run.at(-1) ?? 1)}`];
    return run.map(name);
  });
}

export function summariseHours(windows: HoursWindow[]): string[] {
  const groups = new Map<string, number[]>();
  for (const window of [...windows].sort(
    (a, b) => a.weekday - b.weekday || a.from.localeCompare(b.from),
  )) {
    const key = `${window.from}–${window.to}`;
    groups.set(key, [...(groups.get(key) ?? []), window.weekday]);
  }
  return [...groups.entries()].map(([range, days]) => `${dayRuns(days).join(", ")} ${range}`);
}

export function windowsOnDay(windows: HoursWindow[], weekday: number): HoursWindow[] {
  return windows
    .filter((window) => window.weekday === weekday)
    .sort((a, b) => a.from.localeCompare(b.from));
}

export function worksAt(
  windows: HoursWindow[],
  isoDate: string,
  from: string,
  to: string,
): boolean {
  return windowsOnDay(windows, weekdayOf(isoDate)).some(
    (window) => window.from <= from && to <= window.to,
  );
}
