import { describe, expect, it } from "vitest";
import { endsOn, findOverlap, suggestedStart } from "./sell";

const today = "2026-10-21";
const range = (startsOn: string, endsOnDate: string, cancelledOn: string | null = null) => ({
  startsOn,
  endsOn: endsOnDate,
  cancelledOn,
});

describe("suggestedStart", () => {
  it("is today when the member has nothing running", () => {
    expect(suggestedStart([], today)).toBe(today);
    expect(suggestedStart([range("2026-08-01", "2026-08-30")], today)).toBe(today);
  });

  it("is the day after the latest subscription that still counts", () => {
    expect(suggestedStart([range("2026-10-01", "2026-10-30")], today)).toBe("2026-10-31");
    expect(
      suggestedStart([range("2026-10-01", "2026-10-30"), range("2026-10-31", "2026-11-29")], today),
    ).toBe("2026-11-30");
  });

  it("ignores cancelled subscriptions", () => {
    expect(suggestedStart([range("2026-10-01", "2026-12-30", "2026-10-10")], today)).toBe(today);
  });
});

describe("endsOn", () => {
  it("counts the first day as part of the term, like the server", () => {
    expect(endsOn({ durationDays: 30 }, "2026-10-21")).toBe("2026-11-19");
    expect(endsOn({ durationDays: 1 }, "2026-10-21")).toBe("2026-10-21");
    expect(endsOn({ durationDays: 365 }, "2026-03-01")).toBe("2027-02-28");
  });
});

describe("findOverlap", () => {
  const existing = [range("2026-10-01", "2026-10-30")];

  it("finds a subscription that shares at least one day", () => {
    expect(findOverlap(existing, "2026-10-30", "2026-11-28")).toBe(existing[0]);
    expect(findOverlap(existing, "2026-09-20", "2026-10-01")).toBe(existing[0]);
    expect(findOverlap(existing, "2026-10-10", "2026-10-12")).toBe(existing[0]);
  });

  it("accepts the day after it ends and the day before it starts", () => {
    expect(findOverlap(existing, "2026-10-31", "2026-11-29")).toBeUndefined();
    expect(findOverlap(existing, "2026-09-01", "2026-09-30")).toBeUndefined();
  });

  it("ignores cancelled subscriptions", () => {
    expect(
      findOverlap([range("2026-10-01", "2026-10-30", "2026-10-05")], "2026-10-10", "2026-11-08"),
    ).toBeUndefined();
  });
});
