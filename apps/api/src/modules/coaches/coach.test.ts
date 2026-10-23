import { describe, expect, it } from "vitest";
import { DomainError } from "../../platform/errors.js";
import { Coach, isoWeekday } from "./coach.js";

const profile = { fullName: "Ivan Petrenko", specialization: "Strength training" };

describe("Coach.create", () => {
  it("starts active at version 1 without working hours", () => {
    expect(Coach.create(profile).toSnapshot()).toMatchObject({
      fullName: "Ivan Petrenko",
      specialization: "Strength training",
      weeklyHours: [],
      archived: false,
      version: 1,
    });
  });

  it("sorts the weekly hours by day and start time", () => {
    const coach = Coach.create({
      ...profile,
      weeklyHours: [
        { weekday: 3, from: "14:00", to: "18:00" },
        { weekday: 1, from: "15:00", to: "19:00" },
        { weekday: 1, from: "08:00", to: "12:00" },
      ],
    });

    expect(coach.toSnapshot().weeklyHours).toEqual([
      { weekday: 1, from: "08:00", to: "12:00" },
      { weekday: 1, from: "15:00", to: "19:00" },
      { weekday: 3, from: "14:00", to: "18:00" },
    ]);
  });

  it.each([
    ["a name that is too short", { fullName: "I" }],
    ["a specialization that is too short", { specialization: "x" }],
    ["a weekday of 0", { weeklyHours: [{ weekday: 0, from: "08:00", to: "12:00" }] }],
    ["a weekday of 8", { weeklyHours: [{ weekday: 8, from: "08:00", to: "12:00" }] }],
    ["a malformed time", { weeklyHours: [{ weekday: 1, from: "8:00", to: "12:00" }] }],
    ["an hour of 24", { weeklyHours: [{ weekday: 1, from: "08:00", to: "24:00" }] }],
    [
      "a window that ends before it starts",
      { weeklyHours: [{ weekday: 1, from: "12:00", to: "08:00" }] },
    ],
    ["an empty window", { weeklyHours: [{ weekday: 1, from: "12:00", to: "12:00" }] }],
    [
      "overlapping windows on one day",
      {
        weeklyHours: [
          { weekday: 2, from: "08:00", to: "12:00" },
          { weekday: 2, from: "11:00", to: "15:00" },
        ],
      },
    ],
  ])("rejects %s", (_label, override) => {
    expect(() => Coach.create({ ...profile, ...override })).toThrow(DomainError);
  });

  it("accepts back-to-back windows and the same hours on different days", () => {
    expect(() =>
      Coach.create({
        ...profile,
        weeklyHours: [
          { weekday: 2, from: "08:00", to: "12:00" },
          { weekday: 2, from: "12:00", to: "15:00" },
          { weekday: 3, from: "08:00", to: "12:00" },
        ],
      }),
    ).not.toThrow();
  });
});

describe("Coach.change and archive", () => {
  it("replaces the weekly hours as a whole and keeps the rest", () => {
    const coach = Coach.create({
      ...profile,
      weeklyHours: [{ weekday: 1, from: "08:00", to: "12:00" }],
    });

    coach.change({ weeklyHours: [{ weekday: 5, from: "10:00", to: "14:00" }] });

    expect(coach.toSnapshot()).toMatchObject({
      fullName: "Ivan Petrenko",
      weeklyHours: [{ weekday: 5, from: "10:00", to: "14:00" }],
    });
  });

  it("keeps the previous state when a change is invalid", () => {
    const coach = Coach.create(profile);

    expect(() => coach.change({ specialization: "" })).toThrow(DomainError);
    expect(coach.toSnapshot().specialization).toBe("Strength training");
  });

  it("refuses further changes once archived", () => {
    const coach = Coach.create(profile);

    coach.archive();

    expect(() => coach.archive()).toThrow(DomainError);
    expect(() => coach.change({ fullName: "Someone Else" })).toThrow(DomainError);
  });
});

describe("isoWeekday", () => {
  it("numbers Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-21")).toBe(3);
    expect(isoWeekday("2026-10-25")).toBe(7);
  });

  it("rejects dates that do not exist", () => {
    expect(() => isoWeekday("2026-02-30")).toThrow(DomainError);
  });
});

describe("Coach.worksAt", () => {
  const coach = Coach.create({
    ...profile,
    weeklyHours: [
      { weekday: 3, from: "09:00", to: "13:00" },
      { weekday: 3, from: "16:00", to: "20:00" },
    ],
  });

  it("accepts a slot inside a working window", () => {
    expect(coach.worksAt("2026-10-21", "09:00", "10:00")).toBe(true);
    expect(coach.worksAt("2026-10-21", "12:00", "13:00")).toBe(true);
    expect(coach.worksAt("2026-10-21", "16:30", "18:00")).toBe(true);
  });

  it("rejects slots outside the windows, across a break, or on another weekday", () => {
    expect(coach.worksAt("2026-10-21", "08:30", "09:30")).toBe(false);
    expect(coach.worksAt("2026-10-21", "12:30", "13:30")).toBe(false);
    expect(coach.worksAt("2026-10-21", "12:00", "17:00")).toBe(false);
    expect(coach.worksAt("2026-10-22", "09:00", "10:00")).toBe(false);
  });
});
