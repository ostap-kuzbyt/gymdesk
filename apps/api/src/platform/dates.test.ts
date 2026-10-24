import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./dates.js";

describe("addDays", () => {
  it("moves forward and backward across month and year boundaries", () => {
    expect(addDays("2026-10-21", 7)).toBe("2026-10-28");
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("handles leap years and returns the same day for zero", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-10-21", 0)).toBe("2026-10-21");
  });
});

describe("daysBetween", () => {
  it("counts whole days, negative when the end is earlier", () => {
    expect(daysBetween("2026-10-21", "2026-10-25")).toBe(4);
    expect(daysBetween("2026-10-25", "2026-10-21")).toBe(-4);
    expect(daysBetween("2026-10-21", "2026-10-21")).toBe(0);
  });

  it("is not affected by daylight saving changes", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});
