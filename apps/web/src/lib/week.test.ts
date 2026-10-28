import { describe, expect, it } from "vitest";
import { mondayOf, weekDays } from "./week";

describe("mondayOf", () => {
  it("returns the Monday of the week of any day", () => {
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
    expect(mondayOf("2026-10-21")).toBe("2026-10-19");
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(mondayOf("2026-10-26")).toBe("2026-10-26");
  });

  it("crosses month and year boundaries", () => {
    expect(mondayOf("2026-01-01")).toBe("2025-12-29");
    expect(mondayOf("2026-03-01")).toBe("2026-02-23");
  });
});

describe("weekDays", () => {
  it("lists seven consecutive days from Monday", () => {
    expect(weekDays("2026-10-26")).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});
