import { describe, expect, it } from "vitest";
import { summariseHours, weekdayOf, windowsOnDay, worksAt } from "./hours";

const window = (weekday: number, from: string, to: string) => ({ weekday, from, to });

describe("weekdayOf", () => {
  it("numbers Monday as 1 and Sunday as 7", () => {
    expect(weekdayOf("2026-10-19")).toBe(1);
    expect(weekdayOf("2026-10-21")).toBe(3);
    expect(weekdayOf("2026-10-25")).toBe(7);
  });
});

describe("summariseHours", () => {
  it("is empty without hours", () => {
    expect(summariseHours([])).toEqual([]);
  });

  it("shortens a run of three or more days into a range", () => {
    const week = [1, 2, 3, 4, 5].map((day) => window(day, "07:00", "13:00"));

    expect(summariseHours(week)).toEqual(["Mon–Fri 07:00–13:00"]);
  });

  it("lists one or two days by name", () => {
    expect(summariseHours([window(6, "09:00", "15:00")])).toEqual(["Sat 09:00–15:00"]);
    expect(summariseHours([window(2, "09:00", "12:00"), window(3, "09:00", "12:00")])).toEqual([
      "Tue, Wed 09:00–12:00",
    ]);
  });

  it("splits days that are not next to each other", () => {
    const days = [1, 3, 5].map((day) => window(day, "10:00", "14:00"));

    expect(summariseHours(days)).toEqual(["Mon, Wed, Fri 10:00–14:00"]);
  });

  it("keeps different hours on separate lines, earliest day first", () => {
    const hours = [
      window(6, "09:00", "15:00"),
      window(1, "07:00", "13:00"),
      window(2, "07:00", "13:00"),
      window(3, "07:00", "13:00"),
      window(1, "16:00", "20:00"),
    ];

    expect(summariseHours(hours)).toEqual([
      "Mon–Wed 07:00–13:00",
      "Mon 16:00–20:00",
      "Sat 09:00–15:00",
    ]);
  });
});

describe("windowsOnDay and worksAt", () => {
  const hours = [
    window(3, "16:00", "20:00"),
    window(3, "09:00", "13:00"),
    window(4, "09:00", "13:00"),
  ];

  it("returns the windows of one weekday in time order", () => {
    expect(windowsOnDay(hours, 3).map((item) => item.from)).toEqual(["09:00", "16:00"]);
    expect(windowsOnDay(hours, 7)).toEqual([]);
  });

  it("accepts a slot inside a window and rejects one across a break or on another day", () => {
    expect(worksAt(hours, "2026-10-21", "09:00", "10:00")).toBe(true);
    expect(worksAt(hours, "2026-10-21", "12:30", "13:30")).toBe(false);
    expect(worksAt(hours, "2026-10-21", "12:00", "17:00")).toBe(false);
    expect(worksAt(hours, "2026-10-24", "09:00", "10:00")).toBe(false);
  });
});
