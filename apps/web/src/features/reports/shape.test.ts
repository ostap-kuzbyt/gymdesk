import { describe, expect, it } from "vitest";
import {
  daysIn,
  fillPercent,
  hoursOf,
  periodLabel,
  pivotBookings,
  pivotHours,
  presetRange,
  totalsOf,
} from "./shape";

const row = (
  date: string,
  id: string,
  name: string,
  minutes: number,
  reserved: number,
  capacity: number,
  workouts = 1,
) => ({
  date,
  id,
  name,
  workouts,
  minutes,
  reserved,
  capacity,
});

describe("presetRange", () => {
  const today = "2026-10-21";

  it("covers the last 14 and 30 days including today", () => {
    expect(presetRange("14d", today)).toEqual({ from: "2026-10-08", to: today });
    expect(presetRange("30d", today)).toEqual({ from: "2026-09-22", to: today });
  });

  it("starts at the first day of this month or this year", () => {
    expect(presetRange("month", today)).toEqual({ from: "2026-10-01", to: today });
    expect(presetRange("year", today)).toEqual({ from: "2026-01-01", to: today });
  });

  it("covers the last six calendar months, across a year boundary", () => {
    expect(presetRange("6m", today)).toEqual({ from: "2026-05-01", to: today });
    expect(presetRange("6m", "2026-02-10")).toEqual({ from: "2025-09-01", to: "2026-02-10" });
  });
});

describe("periodLabel", () => {
  it("writes months readably and keeps years", () => {
    expect(periodLabel("2026-08")).toBe("Aug 2026");
    expect(periodLabel("2025")).toBe("2025");
  });
});

describe("hoursOf and fillPercent", () => {
  it("rounds minutes to tenths of an hour and handles empty capacity", () => {
    expect(hoursOf(150)).toBe(2.5);
    expect(hoursOf(100)).toBe(1.7);
    expect(fillPercent(3, 10)).toBe(30);
    expect(fillPercent(1, 3)).toBe(33);
    expect(fillPercent(0, 0)).toBe(0);
  });
});

describe("daysIn", () => {
  it("lists every day of the range", () => {
    expect(daysIn({ from: "2026-10-30", to: "2026-11-02" })).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("pivotHours", () => {
  const rows = [
    row("2026-10-21", "c2", "Olha", 60, 0, 10),
    row("2026-10-21", "c1", "Ivan", 150, 0, 10),
    row("2026-10-23", "c1", "Ivan", 60, 0, 5),
  ];

  it("makes one point per day with hours for each coach, filling gaps with zero", () => {
    const { points, series } = pivotHours(rows, { from: "2026-10-21", to: "2026-10-23" });

    expect(series).toEqual([
      { id: "c1", name: "Ivan" },
      { id: "c2", name: "Olha" },
    ]);
    expect(points).toEqual([
      { date: "2026-10-21", c1: 2.5, c2: 1 },
      { date: "2026-10-22", c1: 0, c2: 0 },
      { date: "2026-10-23", c1: 1, c2: 0 },
    ]);
  });
});

describe("pivotBookings", () => {
  it("adds up booked places and capacity of every studio per day", () => {
    const rows = [
      row("2026-10-21", "s1", "Main", 60, 5, 20),
      row("2026-10-21", "s2", "Yoga", 60, 3, 10),
    ];

    expect(pivotBookings(rows, { from: "2026-10-21", to: "2026-10-22" })).toEqual([
      { date: "2026-10-21", booked: 8, capacity: 30 },
      { date: "2026-10-22", booked: 0, capacity: 0 },
    ]);
  });
});

describe("totalsOf", () => {
  it("sums each coach or studio over the range, busiest first", () => {
    const rows = [
      row("2026-10-21", "c1", "Ivan", 60, 4, 10),
      row("2026-10-22", "c1", "Ivan", 90, 6, 10, 2),
      row("2026-10-21", "c2", "Olha", 240, 2, 10),
    ];

    expect(totalsOf(rows)).toEqual([
      { id: "c2", name: "Olha", workouts: 1, minutes: 240, reserved: 2, capacity: 10 },
      { id: "c1", name: "Ivan", workouts: 3, minutes: 150, reserved: 10, capacity: 20 },
    ]);
  });
});
