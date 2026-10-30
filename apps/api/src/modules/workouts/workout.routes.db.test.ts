import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createClock } from "../../platform/clock.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

const UNKNOWN_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9bffff";
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  from: "08:00",
  to: "22:00",
}));

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;
let instant = new Date("2026-10-21T09:00:00Z");
let counter = 0;

function goTo(isoInstant: string): void {
  instant = new Date(isoInstant);
}

beforeAll(async () => {
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig(), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: createClock("UTC", () => instant),
  });
});

afterAll(async () => {
  await app.close();
  await testDb.dispose();
});

type Role = "admin" | "reception" | "coach";

async function call(method: "GET" | "POST", url: string, role: Role, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: await auth.bearer([role]),
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

async function createStudio(capacity = 10) {
  counter += 1;
  const response = await call("POST", "/api/studios", "admin", {
    name: `Studio ${counter}`,
    capacity,
  });
  return response.json() as { id: string };
}

async function createCoach(weeklyHours: unknown = EVERY_DAY) {
  counter += 1;
  const response = await call("POST", "/api/coaches", "admin", {
    fullName: `Coach ${counter}`,
    specialization: "General fitness",
    weeklyHours,
  });
  return response.json() as { id: string };
}

async function createMember(subscription: { durationDays: number } | null = { durationDays: 60 }) {
  counter += 1;
  const created = await call("POST", "/api/members", "reception", {
    fullName: `Member ${counter}`,
    birthDate: "1990-01-01",
    email: `member${counter}@example.com`,
  });
  const member = created.json() as { id: string };
  if (subscription) {
    const tariff = await call("POST", "/api/tariffs", "admin", {
      name: `Tariff ${counter}`,
      priceCents: 3000,
      durationDays: subscription.durationDays,
    });
    await call("POST", `/api/members/${member.id}/subscriptions`, "reception", {
      tariffId: tariff.json().id,
    });
  }
  return member;
}

interface Setup {
  studioId: string;
  coachId: string;
}

async function setup(): Promise<Setup> {
  return { studioId: (await createStudio()).id, coachId: (await createCoach()).id };
}

function workout(base: Setup, overrides: Record<string, unknown> = {}) {
  return {
    title: "Evening stretch",
    kind: "group",
    studioId: base.studioId,
    coachId: base.coachId,
    date: "2026-10-22",
    startTime: "18:00",
    endTime: "19:00",
    capacity: 5,
    ...overrides,
  };
}

async function schedule(base: Setup, overrides: Record<string, unknown> = {}) {
  return call("POST", "/api/workouts", "reception", workout(base, overrides));
}

describe("access", () => {
  it("lets staff read, front desk write, and refuses anonymous callers", async () => {
    const base = await setup();

    expect(
      (await app.inject({ method: "GET", url: "/api/workouts?from=2026-10-01&to=2026-10-31" }))
        .statusCode,
    ).toBe(401);
    expect(
      (await call("GET", "/api/workouts?from=2026-10-01&to=2026-10-31", "coach")).statusCode,
    ).toBe(200);
    expect((await call("POST", "/api/workouts", "coach", workout(base))).statusCode).toBe(403);
    expect((await call("POST", "/api/workouts", "admin", workout(base))).statusCode).toBe(201);
  });
});

describe("scheduling", () => {
  it("creates a group workout with its capacity and no reservations", async () => {
    const base = await setup();

    const response = await schedule(base);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: "Evening stretch",
      kind: "group",
      date: "2026-10-22",
      startTime: "18:00",
      endTime: "19:00",
      capacity: 5,
      reserved: 0,
      spotsLeft: 5,
      cancelled: false,
      version: 1,
      reservations: [],
    });

    const fetched = await call("GET", `/api/workouts/${response.json().id}`, "reception");
    expect(fetched.json()).toEqual(response.json());
  });

  it("gives an individual session one place and defaults group capacity to the studio", async () => {
    const studio = await createStudio(14);
    const coach = await createCoach();
    const base = { studioId: studio.id, coachId: coach.id };

    const individual = await schedule(base, { kind: "individual", capacity: undefined });
    expect(individual.json().capacity).toBe(1);

    const group = await schedule(base, {
      startTime: "10:00",
      endTime: "11:00",
      capacity: undefined,
    });
    expect(group.json().capacity).toBe(14);
  });

  it("refuses rule violations with 400", async () => {
    const base = await setup();

    expect((await schedule(base, { capacity: 11 })).statusCode).toBe(400);
    expect((await schedule(base, { date: "2026-10-20" })).statusCode).toBe(400);
    expect((await schedule(base, { startTime: "18:00", endTime: "18:05" })).statusCode).toBe(400);
    expect((await schedule(base, { kind: "individual", capacity: 3 })).statusCode).toBe(400);
    expect((await schedule(base, { startTime: "6pm" })).statusCode).toBe(400);
  });

  it("refuses a slot outside the coach's working hours", async () => {
    const studio = await createStudio();
    const coach = await createCoach([{ weekday: 4, from: "09:00", to: "13:00" }]);
    const base = { studioId: studio.id, coachId: coach.id };

    const outside = await schedule(base, { startTime: "18:00", endTime: "19:00" });
    expect(outside.statusCode).toBe(400);
    expect(outside.json().detail).toMatch(/does not work/);

    expect((await schedule(base, { startTime: "10:00", endTime: "11:00" })).statusCode).toBe(201);
  });

  it("answers 404 for an unknown studio or coach and 400 for archived ones", async () => {
    const base = await setup();

    expect((await schedule(base, { studioId: UNKNOWN_ID })).statusCode).toBe(404);
    expect((await schedule(base, { coachId: UNKNOWN_ID })).statusCode).toBe(404);

    await call("POST", `/api/studios/${base.studioId}/archive`, "admin");
    expect((await schedule(base)).statusCode).toBe(400);

    const fresh = await setup();
    await call("POST", `/api/coaches/${fresh.coachId}/archive`, "admin");
    expect((await schedule(fresh)).statusCode).toBe(400);
  });

  it("refuses overlapping workouts in one studio or for one coach", async () => {
    const base = await setup();
    await schedule(base);

    const sameStudio = await schedule(
      { ...base, coachId: (await createCoach()).id },
      { startTime: "18:30", endTime: "19:30" },
    );
    expect(sameStudio.statusCode).toBe(400);
    expect(sameStudio.json().detail).toMatch(/studio/);

    const sameCoach = await schedule(
      { ...base, studioId: (await createStudio()).id },
      { startTime: "18:30", endTime: "19:30" },
    );
    expect(sameCoach.statusCode).toBe(400);
    expect(sameCoach.json().detail).toMatch(/coach/);
  });

  it("allows back-to-back workouts, other days, and reuse of a cancelled slot", async () => {
    const base = await setup();
    const first = await schedule(base);

    expect((await schedule(base, { startTime: "19:00", endTime: "20:00" })).statusCode).toBe(201);
    expect((await schedule(base, { date: "2026-10-23" })).statusCode).toBe(201);

    await call("POST", `/api/workouts/${first.json().id}/cancel`, "reception");
    expect((await schedule(base)).statusCode).toBe(201);
  });
});

describe("schedule view", () => {
  it("filters by range, studio and coach, hides cancelled workouts and counts reservations", async () => {
    const base = await setup();
    const other = await setup();
    const kept = (await schedule(base, { date: "2026-11-02" })).json();
    const cancelled = (await schedule(base, { date: "2026-11-03" })).json();
    await schedule(other, { date: "2026-11-02" });
    await schedule(base, { date: "2026-12-30" });
    await call("POST", `/api/workouts/${cancelled.id}/cancel`, "admin");

    const member = await createMember();
    await call("POST", `/api/workouts/${kept.id}/reservations`, "reception", {
      memberId: member.id,
    });

    const range = `from=2026-11-01&to=2026-11-30&studioId=${base.studioId}`;
    const list = await call("GET", `/api/workouts?${range}`, "reception");
    expect(list.json().map((item: { id: string }) => item.id)).toEqual([kept.id]);
    expect(list.json()[0]).toMatchObject({ reserved: 1, capacity: 5 });

    const withCancelled = await call(
      "GET",
      `/api/workouts?${range}&includeCancelled=true`,
      "reception",
    );
    expect(withCancelled.json()).toHaveLength(2);

    const byCoach = await call(
      "GET",
      `/api/workouts?from=2026-11-01&to=2026-11-30&coachId=${other.coachId}`,
      "reception",
    );
    expect(byCoach.json()).toHaveLength(1);
  });

  it("orders by date and start time and rejects bad ranges", async () => {
    const base = await setup();
    await schedule(base, { date: "2026-11-10", startTime: "15:00", endTime: "16:00" });
    await schedule(base, { date: "2026-11-10", startTime: "09:00", endTime: "10:00" });
    await schedule(base, { date: "2026-11-09", startTime: "20:00", endTime: "21:00" });

    const list = await call(
      "GET",
      `/api/workouts?from=2026-11-09&to=2026-11-10&coachId=${base.coachId}`,
      "admin",
    );
    expect(
      list
        .json()
        .map((item: { date: string; startTime: string }) => `${item.date} ${item.startTime}`),
    ).toEqual(["2026-11-09 20:00", "2026-11-10 09:00", "2026-11-10 15:00"]);

    expect(
      (await call("GET", "/api/workouts?from=2026-11-10&to=2026-11-09", "admin")).statusCode,
    ).toBe(400);
    expect(
      (await call("GET", "/api/workouts?from=2026-01-01&to=2026-12-31", "admin")).statusCode,
    ).toBe(400);
    expect((await call("GET", "/api/workouts", "admin")).statusCode).toBe(400);
  });
});

describe("reservations", () => {
  it("signs a member with an active subscription up and shows the name", async () => {
    const base = await setup();
    const created = (await schedule(base)).json();
    const member = await createMember();

    const response = await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: member.id,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      reserved: 1,
      spotsLeft: 4,
      version: 2,
      reservations: [
        { memberId: member.id, memberName: expect.stringMatching(/^Member/), cancelledAt: null },
      ],
    });
  });

  it("refuses members without a subscription that covers the workout date", async () => {
    const base = await setup();
    const created = (await schedule(base, { date: "2026-12-20" })).json();
    const without = await createMember(null);
    const shortTerm = await createMember({ durationDays: 10 });

    const none = await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: without.id,
    });
    expect(none.statusCode).toBe(400);
    expect(none.json().detail).toMatch(/no active subscription/);

    const expired = await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: shortTerm.id,
    });
    expect(expired.statusCode).toBe(400);
  });

  it("answers 409 for a duplicate booking and when the workout is full", async () => {
    const base = await setup();
    const created = (await schedule(base, { capacity: 2 })).json();
    const [first, second, third] = [
      await createMember(),
      await createMember(),
      await createMember(),
    ];
    const reserve = (memberId: string) =>
      call("POST", `/api/workouts/${created.id}/reservations`, "reception", { memberId });

    expect((await reserve(first.id)).statusCode).toBe(201);
    expect((await reserve(first.id)).statusCode).toBe(409);
    expect((await reserve(second.id)).statusCode).toBe(201);
    expect((await reserve(third.id)).statusCode).toBe(409);
  });

  it("frees the place when a reservation is cancelled", async () => {
    const base = await setup();
    const created = (await schedule(base, { capacity: 2 })).json();
    const [first, second, third] = [
      await createMember(),
      await createMember(),
      await createMember(),
    ];
    const reserve = (memberId: string) =>
      call("POST", `/api/workouts/${created.id}/reservations`, "reception", { memberId });

    const booked = await reserve(first.id);
    await reserve(second.id);
    const reservationId = booked.json().reservations[0].id;

    const cancelled = await call(
      "POST",
      `/api/workouts/${created.id}/reservations/${reservationId}/cancel`,
      "reception",
    );
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ reserved: 1, spotsLeft: 1 });
    const cancelledReservation = cancelled
      .json()
      .reservations.find((item: { id: string }) => item.id === reservationId);
    expect(cancelledReservation.cancelledAt).not.toBeNull();

    expect((await reserve(third.id)).statusCode).toBe(201);
    expect((await reserve(first.id)).statusCode).toBe(409);
  });

  it("answers 404 for unknown workouts, members and reservations", async () => {
    const base = await setup();
    const created = (await schedule(base)).json();
    const member = await createMember();

    expect(
      (
        await call("POST", `/api/workouts/${UNKNOWN_ID}/reservations`, "reception", {
          memberId: member.id,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
          memberId: UNKNOWN_ID,
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call(
          "POST",
          `/api/workouts/${created.id}/reservations/${UNKNOWN_ID}/cancel`,
          "reception",
        )
      ).statusCode,
    ).toBe(404);
  });

  it("refuses bookings and cancellations once the workout has started", async () => {
    const base = await setup();
    const created = (
      await schedule(base, { date: "2026-10-21", startTime: "12:00", endTime: "13:00" })
    ).json();
    const member = await createMember();
    const late = await createMember();
    const booked = await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: member.id,
    });

    goTo("2026-10-21T12:00:00Z");

    const tooLate = await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: late.id,
    });
    expect(tooLate.statusCode).toBe(400);
    const cancel = await call(
      "POST",
      `/api/workouts/${created.id}/reservations/${booked.json().reservations[0].id}/cancel`,
      "reception",
    );
    expect(cancel.statusCode).toBe(400);

    goTo("2026-10-21T09:00:00Z");
  });

  it("lets only one of two members take the last place", async () => {
    const base = await setup();
    const created = (await schedule(base, { capacity: 2 })).json();
    const [first, second, third] = [
      await createMember(),
      await createMember(),
      await createMember(),
    ];
    await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: first.id,
    });

    const results = await Promise.all(
      [second, third].map((member) =>
        call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
          memberId: member.id,
        }),
      ),
    );

    expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
    const final = await call("GET", `/api/workouts/${created.id}`, "admin");
    expect(final.json().reserved).toBe(2);
  });
});

describe("cancelling a workout", () => {
  it("cancels it, keeps the reservations and refuses further bookings", async () => {
    const base = await setup();
    const created = (await schedule(base)).json();
    const member = await createMember();
    await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
      memberId: member.id,
    });

    const cancelled = await call("POST", `/api/workouts/${created.id}/cancel`, "reception");
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ cancelled: true, reserved: 1 });

    const another = await createMember();
    expect(
      (
        await call("POST", `/api/workouts/${created.id}/reservations`, "reception", {
          memberId: another.id,
        })
      ).statusCode,
    ).toBe(400);
    expect((await call("POST", `/api/workouts/${created.id}/cancel`, "reception")).statusCode).toBe(
      400,
    );
  });

  it("answers 404 for an unknown workout", async () => {
    expect((await call("POST", `/api/workouts/${UNKNOWN_ID}/cancel`, "admin")).statusCode).toBe(
      404,
    );
    expect((await call("GET", `/api/workouts/${UNKNOWN_ID}`, "admin")).statusCode).toBe(404);
  });
});
