import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatTerm, formatVisits, todayLocal } from "./format";

describe("formatMoney", () => {
  it("turns cents into a currency amount", () => {
    expect(formatMoney(4900, "UAH")).toMatch(/49\.00/);
    expect(formatMoney(4900, "UAH")).toMatch(/UAH/);
    expect(formatMoney(0, "USD")).toMatch(/0\.00/);
    expect(formatMoney(44999, "EUR")).toMatch(/449\.99/);
  });
});

describe("formatTerm and formatVisits", () => {
  it("uses the singular for one", () => {
    expect(formatTerm(1)).toBe("1 day");
    expect(formatTerm(30)).toBe("30 days");
    expect(formatVisits(1)).toBe("1 visit");
    expect(formatVisits(12)).toBe("12 visits");
  });

  it("calls a missing limit unlimited", () => {
    expect(formatVisits(null)).toBe("Unlimited");
  });
});

describe("formatDate", () => {
  it("writes a short readable date without shifting the day", () => {
    expect(formatDate("2026-10-21")).toBe("21 Oct 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
  });
});

describe("todayLocal", () => {
  it("formats the local calendar day as yyyy-mm-dd", () => {
    expect(todayLocal(new Date(2026, 9, 21, 23, 30))).toBe("2026-10-21");
    expect(todayLocal(new Date(2026, 2, 4, 0, 5))).toBe("2026-03-04");
  });
});
