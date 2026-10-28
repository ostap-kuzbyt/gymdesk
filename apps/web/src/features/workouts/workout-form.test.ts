import { describe, expect, it } from "vitest";
import { emptyWorkoutForm, startProblem, toNewWorkout, workoutFormSchema } from "./workout-form";

const valid = {
  title: "Morning yoga",
  kind: "group" as const,
  studioId: "studio-1",
  coachId: "coach-1",
  date: "2026-10-22",
  startTime: "10:00",
  endTime: "11:00",
  capacity: "",
};

function issuesOf(values: unknown) {
  const result = workoutFormSchema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("workoutFormSchema", () => {
  it("accepts a complete group workout with or without a capacity", () => {
    expect(issuesOf(valid)).toEqual([]);
    expect(issuesOf({ ...valid, capacity: "12" })).toEqual([]);
  });

  it("asks for the things that are missing", () => {
    expect(issuesOf({ ...valid, title: "", studioId: "", coachId: "" })).toEqual([
      "title: Enter a title of at least 2 characters",
      "studioId: Choose a studio",
      "coachId: Choose a coach",
    ]);
  });

  it("checks the length of the workout", () => {
    expect(issuesOf({ ...valid, startTime: "11:00", endTime: "10:00" })).toEqual([
      "endTime: Must end after it starts",
    ]);
    expect(issuesOf({ ...valid, endTime: "10:10" })).toEqual([
      "endTime: A workout lasts between 15 minutes and 4 hours",
    ]);
    expect(issuesOf({ ...valid, endTime: "14:30" })).toEqual([
      "endTime: A workout lasts between 15 minutes and 4 hours",
    ]);
    expect(issuesOf({ ...valid, endTime: "14:00" })).toEqual([]);
  });

  it("needs at least two places for a group but ignores the field for a personal session", () => {
    expect(issuesOf({ ...valid, capacity: "1" })).toEqual([
      "capacity: A group workout needs at least 2 places",
    ]);
    expect(issuesOf({ ...valid, kind: "individual", capacity: "1" })).toEqual([]);
    expect(issuesOf({ ...valid, capacity: "many" })).toEqual([
      "capacity: Enter a whole number of places",
    ]);
  });

  it("rejects a date that does not exist", () => {
    expect(issuesOf({ ...valid, date: "2026-02-30" })).toEqual(["date: Enter the date"]);
  });
});

describe("startProblem", () => {
  it("refuses a past day and a time that has passed today", () => {
    expect(startProblem({ date: "2026-10-20", startTime: "10:00" }, "2026-10-21", "09:00")).toBe(
      "The date cannot be in the past",
    );
    expect(startProblem({ date: "2026-10-21", startTime: "09:00" }, "2026-10-21", "09:00")).toBe(
      "That time has already passed today",
    );
  });

  it("accepts later today and any future day", () => {
    expect(
      startProblem({ date: "2026-10-21", startTime: "09:01" }, "2026-10-21", "09:00"),
    ).toBeUndefined();
    expect(
      startProblem({ date: "2026-10-22", startTime: "06:00" }, "2026-10-21", "23:00"),
    ).toBeUndefined();
  });
});

describe("toNewWorkout", () => {
  it("sends a capacity only for a group workout that has one", () => {
    expect(toNewWorkout({ ...valid, title: " Morning yoga " })).toEqual({
      title: "Morning yoga",
      kind: "group",
      studioId: "studio-1",
      coachId: "coach-1",
      date: "2026-10-22",
      startTime: "10:00",
      endTime: "11:00",
    });
    expect(toNewWorkout({ ...valid, capacity: "12" }).capacity).toBe(12);
    expect(toNewWorkout({ ...valid, kind: "individual", capacity: "12" }).capacity).toBeUndefined();
  });

  it("starts with a group workout today in the evening", () => {
    expect(emptyWorkoutForm("2026-10-21")).toMatchObject({
      kind: "group",
      date: "2026-10-21",
      startTime: "18:00",
      endTime: "19:00",
    });
  });
});
