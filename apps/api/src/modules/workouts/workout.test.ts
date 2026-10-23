import { describe, expect, it } from "vitest";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import { Workout } from "./workout.js";
import type { Moment, NewWorkout } from "./workout.js";

const now: Moment = { date: "2026-10-21", time: "09:00", iso: "2026-10-21T09:00:00.000Z" };

function at(date: string, time: string): Moment {
  return { date, time, iso: `${date}T${time}:00.000Z` };
}

const yoga: NewWorkout = {
  title: "Morning yoga",
  kind: "group",
  studioId: "studio-1",
  coachId: "coach-1",
  date: "2026-10-22",
  startTime: "10:00",
  endTime: "11:00",
  capacity: 10,
};

function scheduled(overrides: Partial<NewWorkout> = {}, studioCapacity = 20): Workout {
  return Workout.schedule({ ...yoga, ...overrides }, studioCapacity, now, "workout-1");
}

describe("Workout.schedule", () => {
  it("creates an open workout with no reservations", () => {
    expect(scheduled().toSnapshot()).toMatchObject({
      title: "Morning yoga",
      kind: "group",
      capacity: 10,
      cancelled: false,
      version: 1,
      reservations: [],
    });
  });

  it("defaults a group workout to the full studio capacity", () => {
    expect(scheduled({ capacity: undefined }, 18).toSnapshot().capacity).toBe(18);
  });

  it("gives an individual session exactly one place", () => {
    const session = scheduled({ kind: "individual", capacity: undefined });

    expect(session.toSnapshot().capacity).toBe(1);
    expect(() => scheduled({ kind: "individual", capacity: 3 })).toThrow(DomainError);
    expect(() => scheduled({ kind: "individual", capacity: 1 })).not.toThrow();
  });

  it.each([
    ["a title that is too short", { title: "x" }],
    ["a date that does not exist", { date: "2026-02-30" }],
    ["a malformed time", { startTime: "9:00" }],
    ["an end before the start", { startTime: "11:00", endTime: "10:00" }],
    ["a session shorter than 15 minutes", { startTime: "10:00", endTime: "10:10" }],
    ["a session longer than 4 hours", { startTime: "10:00", endTime: "14:30" }],
    ["a date in the past", { date: "2026-10-20" }],
    ["a start earlier today", { date: "2026-10-21", startTime: "08:00", endTime: "09:00" }],
    ["a start at this very minute", { date: "2026-10-21", startTime: "09:00", endTime: "10:00" }],
    ["a group of one", { capacity: 1 }],
    ["a capacity above the studio", { capacity: 21 }],
    ["a fractional capacity", { capacity: 4.5 }],
  ])("rejects %s", (_label, override) => {
    expect(() => scheduled(override)).toThrow(DomainError);
  });

  it("accepts a workout later today", () => {
    expect(() =>
      scheduled({ date: "2026-10-21", startTime: "09:01", endTime: "10:00" }),
    ).not.toThrow();
  });
});

describe("Workout.reserve", () => {
  it("adds an active reservation and reduces the free places", () => {
    const workout = scheduled();

    const reservation = workout.reserve("member-1", now, "r1");

    expect(reservation).toEqual({
      id: "r1",
      memberId: "member-1",
      reservedAt: now.iso,
      cancelledAt: null,
    });
    expect(workout.spotsLeft).toBe(9);
  });

  it("refuses the same member twice with a conflict", () => {
    const workout = scheduled();
    workout.reserve("member-1", now);

    expect(() => workout.reserve("member-1", now)).toThrow(ConflictError);
  });

  it("refuses a reservation once the workout is full and allows it again after a cancellation", () => {
    const workout = scheduled({ capacity: 2 });
    workout.reserve("member-1", now, "r1");
    workout.reserve("member-2", now, "r2");

    expect(() => workout.reserve("member-3", now)).toThrow(ConflictError);

    workout.cancelReservation("r1", now);
    expect(() => workout.reserve("member-3", now)).not.toThrow();
    expect(workout.spotsLeft).toBe(0);
  });

  it("lets a member sign up again after cancelling their own reservation", () => {
    const workout = scheduled();
    workout.reserve("member-1", now, "r1");
    workout.cancelReservation("r1", now);

    expect(() => workout.reserve("member-1", now, "r2")).not.toThrow();
    expect(workout.toSnapshot().reservations).toHaveLength(2);
  });

  it("refuses a cancelled workout and one that has started", () => {
    const cancelled = scheduled();
    cancelled.cancel(now);
    expect(() => cancelled.reserve("member-1", now)).toThrow(DomainError);

    const started = scheduled();
    expect(() => started.reserve("member-1", at("2026-10-22", "10:00"))).toThrow(DomainError);
    expect(() => started.reserve("member-1", at("2026-10-22", "09:59"))).not.toThrow();
  });
});

describe("Workout.cancelReservation", () => {
  it("stamps the cancellation time and keeps the record", () => {
    const workout = scheduled();
    workout.reserve("member-1", now, "r1");

    workout.cancelReservation("r1", at("2026-10-21", "12:00"));

    expect(workout.toSnapshot().reservations[0]?.cancelledAt).toBe("2026-10-21T12:00:00.000Z");
  });

  it("refuses unknown reservations, repeated cancellations and late cancellations", () => {
    const workout = scheduled();
    workout.reserve("member-1", now, "r1");

    expect(() => workout.cancelReservation("missing", now)).toThrow(NotFoundError);
    expect(() => workout.cancelReservation("r1", at("2026-10-22", "10:30"))).toThrow(DomainError);

    workout.cancelReservation("r1", now);
    expect(() => workout.cancelReservation("r1", now)).toThrow(DomainError);
  });
});

describe("Workout.cancel", () => {
  it("cancels once and refuses a repeat", () => {
    const workout = scheduled();

    workout.cancel(now);

    expect(workout.cancelled).toBe(true);
    expect(() => workout.cancel(now)).toThrow(DomainError);
  });

  it("refuses to cancel a workout that has finished", () => {
    const workout = scheduled();

    expect(() => workout.cancel(at("2026-10-22", "11:00"))).toThrow(DomainError);
    expect(() => workout.cancel(at("2026-10-22", "10:30"))).not.toThrow();
  });
});

describe("Workout.restore", () => {
  it("does not share reservation objects with the snapshot it came from", () => {
    const workout = scheduled();
    workout.reserve("member-1", now, "r1");
    const snapshot = workout.toSnapshot();

    const restored = Workout.restore(snapshot);
    restored.cancelReservation("r1", now);

    expect(snapshot.reservations[0]?.cancelledAt).toBeNull();
  });
});
