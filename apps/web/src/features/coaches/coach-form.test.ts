import { describe, expect, it } from "vitest";
import { coachFormSchema, formValuesOf, toCoachInput } from "./coach-form";

const valid = {
  fullName: "Ivan Petrenko",
  specialization: "Strength training",
  weeklyHours: [{ weekday: "1", from: "08:00", to: "12:00" }],
};

function issuesOf(values: unknown) {
  const result = coachFormSchema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("coachFormSchema", () => {
  it("accepts a coach with and without working hours", () => {
    expect(coachFormSchema.safeParse(valid).success).toBe(true);
    expect(coachFormSchema.safeParse({ ...valid, weeklyHours: [] }).success).toBe(true);
  });

  it("explains missing names", () => {
    expect(issuesOf({ ...valid, fullName: "I", specialization: "" })).toEqual([
      "fullName: Enter the coach's full name",
      "specialization: Enter a specialization",
    ]);
  });

  it("rejects a window that ends before it starts, on that window's end field", () => {
    expect(
      issuesOf({ ...valid, weeklyHours: [{ weekday: "2", from: "12:00", to: "08:00" }] }),
    ).toEqual(["weeklyHours.0.to: Must end after it starts"]);
  });

  it("rejects overlapping windows on the same day but not on different days or back to back", () => {
    const overlapping = [
      { weekday: "2", from: "08:00", to: "12:00" },
      { weekday: "2", from: "11:00", to: "14:00" },
    ];
    expect(issuesOf({ ...valid, weeklyHours: overlapping })).toEqual([
      "weeklyHours.1.from: Overlaps another window on the same day",
    ]);

    const fine = [
      { weekday: "2", from: "08:00", to: "12:00" },
      { weekday: "2", from: "12:00", to: "15:00" },
      { weekday: "3", from: "08:00", to: "12:00" },
    ];
    expect(issuesOf({ ...valid, weeklyHours: fine })).toEqual([]);
  });

  it("rejects an unfinished window", () => {
    expect(issuesOf({ ...valid, weeklyHours: [{ weekday: "1", from: "", to: "12:00" }] })).toEqual([
      "weeklyHours.0.from: Enter the start time",
    ]);
  });
});

describe("conversions", () => {
  it("turns weekdays into numbers for the api and back into text for the form", () => {
    expect(toCoachInput({ ...valid, fullName: " Ivan Petrenko " })).toEqual({
      fullName: "Ivan Petrenko",
      specialization: "Strength training",
      weeklyHours: [{ weekday: 1, from: "08:00", to: "12:00" }],
    });
    expect(
      formValuesOf({
        id: "c1",
        archived: false,
        version: 2,
        fullName: "Ivan Petrenko",
        specialization: "Strength training",
        weeklyHours: [{ weekday: 1, from: "08:00", to: "12:00" }],
      }),
    ).toEqual(valid);
  });
});
