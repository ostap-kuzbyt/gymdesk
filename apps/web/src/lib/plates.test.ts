import { describe, expect, it } from "vitest";
import { addDays, daysBetween } from "./dates";
import { plateFor } from "./plates";

const today = "2026-10-21";

describe("daysBetween and addDays", () => {
  it("count whole calendar days in both directions", () => {
    expect(daysBetween("2026-10-21", "2026-10-25")).toBe(4);
    expect(daysBetween("2026-10-25", "2026-10-21")).toBe(-4);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("plateFor", () => {
  const active = (endsOn: string) =>
    plateFor({ status: "active", startsOn: "2026-10-01", endsOn, today });

  it("is green with the days left while there is plenty of time", () => {
    expect(active("2026-11-20")).toEqual({ tone: "green", value: "30", label: "30 days left" });
  });

  it("turns yellow in the last week, including the 7th day", () => {
    expect(active("2026-10-28")).toMatchObject({ tone: "yellow", value: "7" });
    expect(active("2026-10-29")).toMatchObject({ tone: "green", value: "8" });
  });

  it("words the last day and a single day left correctly", () => {
    expect(active("2026-10-21")).toEqual({ tone: "yellow", value: "0", label: "Last day today" });
    expect(active("2026-10-22")).toMatchObject({ value: "1", label: "1 day left" });
  });

  it("is blue with the days until an upcoming subscription starts", () => {
    expect(
      plateFor({ status: "upcoming", startsOn: "2026-10-24", endsOn: "2026-11-22", today }),
    ).toEqual({
      tone: "blue",
      value: "3",
      label: "Starts in 3 days",
    });
  });

  it("is red for expired and cancelled subscriptions", () => {
    const base = { startsOn: "2026-09-01", endsOn: "2026-09-30", today };

    expect(plateFor({ ...base, status: "expired" })).toEqual({
      tone: "red",
      value: "0",
      label: "Expired",
    });
    expect(plateFor({ ...base, status: "cancelled" })).toEqual({
      tone: "red",
      value: "×",
      label: "Cancelled",
    });
  });
});
