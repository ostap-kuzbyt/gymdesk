import { describe, expect, it } from "vitest";
import { matchesQuery } from "./matches";

describe("matchesQuery", () => {
  it("matches everything for an empty query", () => {
    expect(matchesQuery("Reports", "")).toBe(true);
    expect(matchesQuery("Reports", "   ")).toBe(true);
  });

  it("ignores case and matches a part of the label", () => {
    expect(matchesQuery("Reminders", "REM")).toBe(true);
    expect(matchesQuery("Reminders", "inde")).toBe(true);
    expect(matchesQuery("Reminders", "xyz")).toBe(false);
  });

  it("needs every word to be present, in any order", () => {
    expect(matchesQuery("Olena Shevchenko", "shev ole")).toBe(true);
    expect(matchesQuery("Olena Shevchenko", "olena kovalenko")).toBe(false);
  });
});
