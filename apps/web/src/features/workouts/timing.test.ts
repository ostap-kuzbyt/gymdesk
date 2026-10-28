import { describe, expect, it } from "vitest";
import { hasEnded, hasStarted } from "./timing";

const slot = { date: "2026-10-21", startTime: "18:00", endTime: "19:00" };
const at = (hours: number, minutes: number, day = 21) => new Date(2026, 9, day, hours, minutes);

describe("hasStarted", () => {
  it("is false until the start minute and true from then on", () => {
    expect(hasStarted(slot, at(17, 59))).toBe(false);
    expect(hasStarted(slot, at(18, 0))).toBe(true);
    expect(hasStarted(slot, at(21, 30))).toBe(true);
  });

  it("looks at the day first", () => {
    expect(hasStarted(slot, at(23, 0, 20))).toBe(false);
    expect(hasStarted(slot, at(0, 5, 22))).toBe(true);
  });
});

describe("hasEnded", () => {
  it("is false while it runs and true from the end minute", () => {
    expect(hasEnded(slot, at(18, 30))).toBe(false);
    expect(hasEnded(slot, at(19, 0))).toBe(true);
    expect(hasEnded(slot, at(12, 0, 22))).toBe(true);
    expect(hasEnded(slot, at(12, 0, 20))).toBe(false);
  });
});
