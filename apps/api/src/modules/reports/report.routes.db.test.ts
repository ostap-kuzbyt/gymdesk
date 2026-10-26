import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createClock } from "../../platform/clock.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

type Role = "admin" | "reception" | "coach";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;
let instant: Date;
let counter = 0;

function goTo(day: string): void {
  instant = new Date(`${day}T09:00:00Z`);
}

beforeEach(async () => {
  goTo("2026-10-21");
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig(), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: createClock("UTC", () => instant),
  });
});

afterEach(async () => {
  await app.close();
  await testDb.dispose();
});

async function call(method: "GET" | "POST", url: string, role: Role, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: await auth.bearer([role]),
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

async function createMember(fullName: string) {
  counter += 1;
  const response = await call("POST", "/api/members", "reception", {
    fullName,
    birthDate: "1990-01-01",
    email: `member${counter}@example.com`,
  });
  return response.json() as { id: string };
}

async function sell(memberId: string, priceCents: number, durationDays = 30) {
  counter += 1;
  const tariff = await call("POST", "/api/tariffs", "admin", {
    name: `Tariff ${counter}`,
    priceCents,
    durationDays,
  });
  const response = await call("POST", `/api/members/${memberId}/subscriptions`, "reception", {
    tariffId: tariff.json().id,
  });
  return response.json().subscriptions.at(-1) as { id: string };
}

describe("revenue report", () => {
  beforeEach(async () => {
    const a = await createMember("Member A");
    const b = await createMember("Member B");
    const c = await createMember("Member C");
    const d = await createMember("Member D");
    const e = await createMember("Member E");

    goTo("2025-12-15");
    await sell(d.id, 9000, 365);
    goTo("2026-08-10");
    await sell(a.id, 5000);
    goTo("2026-09-05");
    await sell(b.id, 3000);
    goTo("2026-09-10");
    const refunded = await sell(e.id, 7000);
    await call("POST", `/api/members/${e.id}/subscriptions/${refunded.id}/cancel`, "reception");
    goTo("2026-09-20");
    await sell(a.id, 5000);
    goTo("2026-10-02");
    await sell(c.id, 12000, 365);
  });

  it("sums subscription prices per month, filling empty months and skipping cancelled ones", async () => {
    const response = await call(
      "GET",
      "/api/reports/revenue?from=2026-07-01&to=2026-10-31",
      "admin",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      granularity: "month",
      rows: [
        { period: "2026-07", revenueCents: 0, subscriptions: 0 },
        { period: "2026-08", revenueCents: 5000, subscriptions: 1 },
        { period: "2026-09", revenueCents: 8000, subscriptions: 2 },
        { period: "2026-10", revenueCents: 12000, subscriptions: 1 },
      ],
      totalCents: 25000,
      totalSubscriptions: 4,
    });
  });

  it("groups by year", async () => {
    const response = await call(
      "GET",
      "/api/reports/revenue?from=2025-01-01&to=2026-12-31&granularity=year",
      "admin",
    );

    expect(response.json()).toMatchObject({
      granularity: "year",
      rows: [
        { period: "2025", revenueCents: 9000, subscriptions: 1 },
        { period: "2026", revenueCents: 25000, subscriptions: 4 },
      ],
      totalCents: 34000,
    });
  });

  it("limits the window to the requested range", async () => {
    const response = await call(
      "GET",
      "/api/reports/revenue?from=2026-09-06&to=2026-09-30",
      "admin",
    );

    expect(response.json().rows).toEqual([
      { period: "2026-09", revenueCents: 5000, subscriptions: 1 },
    ]);
  });

  it("is for admins only and validates the range", async () => {
    const query = "?from=2026-07-01&to=2026-10-31";
    expect(
      (await app.inject({ method: "GET", url: `/api/reports/revenue${query}` })).statusCode,
    ).toBe(401);
    expect((await call("GET", `/api/reports/revenue${query}`, "reception")).statusCode).toBe(403);
    expect(
      (await call("GET", "/api/reports/revenue?from=2026-10-31&to=2026-07-01", "admin")).statusCode,
    ).toBe(400);
    expect(
      (await call("GET", "/api/reports/revenue?from=2000-01-01&to=2026-07-01", "admin")).statusCode,
    ).toBe(400);
    expect((await call("GET", "/api/reports/revenue", "admin")).statusCode).toBe(400);
  });
});

describe("attendance report", () => {
  beforeEach(async () => {
    const x = await createMember("Xenia Active");
    const y = await createMember("Yaroslav Occasional");
    await createMember("Zoriana Absent");

    goTo("2026-10-01");
    await sell(x.id, 4900);
    await sell(y.id, 4900);

    const checkIn = (memberId: string) =>
      call("POST", `/api/members/${memberId}/check-ins`, "reception");
    await checkIn(x.id);
    goTo("2026-10-02");
    await checkIn(x.id);
    await checkIn(y.id);
    goTo("2026-10-03");
    await checkIn(x.id);
  });

  it("counts visits in the range, newest visit overall and the active subscription end", async () => {
    const response = await call(
      "GET",
      "/api/reports/attendance?from=2026-10-01&to=2026-10-02",
      "reception",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      from: "2026-10-01",
      to: "2026-10-02",
      total: 3,
      items: [
        {
          memberId: expect.any(String),
          fullName: "Xenia Active",
          email: expect.any(String),
          visits: 2,
          lastVisitOn: "2026-10-03",
          activeUntil: "2026-10-30",
        },
        expect.objectContaining({
          fullName: "Yaroslav Occasional",
          visits: 1,
          lastVisitOn: "2026-10-02",
        }),
        expect.objectContaining({
          fullName: "Zoriana Absent",
          visits: 0,
          lastVisitOn: null,
          activeUntil: null,
        }),
      ],
    });
  });

  it("counts only the visits inside the range", async () => {
    const response = await call(
      "GET",
      "/api/reports/attendance?from=2026-10-03&to=2026-10-03",
      "admin",
    );

    expect(
      response
        .json()
        .items.map((item: { fullName: string; visits: number }) => [item.fullName, item.visits]),
    ).toEqual([
      ["Xenia Active", 1],
      ["Yaroslav Occasional", 0],
      ["Zoriana Absent", 0],
    ]);
  });

  it("paginates and keeps the total", async () => {
    const response = await call(
      "GET",
      "/api/reports/attendance?from=2026-10-01&to=2026-10-31&limit=1&offset=1",
      "admin",
    );

    expect(response.json()).toMatchObject({
      total: 3,
      items: [{ fullName: "Yaroslav Occasional" }],
    });
  });

  it("is hidden from coaches and validates the range", async () => {
    expect(
      (await call("GET", "/api/reports/attendance?from=2026-10-01&to=2026-10-02", "coach"))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("GET", "/api/reports/attendance?from=2026-10-05&to=2026-10-02", "admin"))
        .statusCode,
    ).toBe(400);
  });
});

describe("load report", () => {
  const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    from: "08:00",
    to: "22:00",
  }));
  let main: { id: string };
  let small: { id: string };
  let ivan: { id: string };
  let olha: { id: string };

  async function schedule(
    studioId: string,
    coachId: string,
    date: string,
    start: string,
    end: string,
    capacity: number,
  ) {
    const response = await call("POST", "/api/workouts", "reception", {
      title: "Class",
      kind: "group",
      studioId,
      coachId,
      date,
      startTime: start,
      endTime: end,
      capacity,
    });
    return response.json() as { id: string };
  }

  beforeEach(async () => {
    main = (
      await call("POST", "/api/studios", "admin", { name: "Main hall", capacity: 10 })
    ).json();
    small = (
      await call("POST", "/api/studios", "admin", { name: "Small room", capacity: 20 })
    ).json();
    ivan = (
      await call("POST", "/api/coaches", "admin", {
        fullName: "Ivan Coach",
        specialization: "Strength",
        weeklyHours: EVERY_DAY,
      })
    ).json();
    olha = (
      await call("POST", "/api/coaches", "admin", {
        fullName: "Olha Coach",
        specialization: "Yoga",
        weeklyHours: EVERY_DAY,
      })
    ).json();

    const first = await schedule(main.id, ivan.id, "2026-10-22", "10:00", "11:00", 5);
    const second = await schedule(main.id, ivan.id, "2026-10-22", "12:00", "13:30", 5);
    await schedule(small.id, olha.id, "2026-10-22", "10:00", "11:00", 10);
    await schedule(main.id, ivan.id, "2026-10-23", "10:00", "11:00", 5);
    const cancelled = await schedule(main.id, ivan.id, "2026-10-22", "15:00", "16:00", 5);
    await call("POST", `/api/workouts/${cancelled.id}/cancel`, "reception");

    const people = [await createMember("P1"), await createMember("P2"), await createMember("P3")];
    for (const person of people) await sell(person.id, 1000, 30);
    const reserve = (workoutId: string, memberId: string) =>
      call("POST", `/api/workouts/${workoutId}/reservations`, "reception", { memberId });
    await reserve(first.id, people[0]!.id);
    await reserve(first.id, people[1]!.id);
    const dropped = await reserve(second.id, people[0]!.id);
    await reserve(second.id, people[2]!.id);
    await call(
      "POST",
      `/api/workouts/${second.id}/reservations/${dropped.json().reservations.find((item: { memberId: string }) => item.memberId === people[0]!.id).id}/cancel`,
      "reception",
    );
  });

  it("aggregates coach and room load per day, ignoring cancelled workouts and reservations", async () => {
    const response = await call(
      "GET",
      "/api/reports/load?from=2026-10-22&to=2026-10-23",
      "reception",
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      from: "2026-10-22",
      to: "2026-10-23",
      coaches: [
        {
          date: "2026-10-22",
          id: ivan.id,
          name: "Ivan Coach",
          workouts: 2,
          minutes: 150,
          reserved: 3,
          capacity: 10,
        },
        {
          date: "2026-10-22",
          id: olha.id,
          name: "Olha Coach",
          workouts: 1,
          minutes: 60,
          reserved: 0,
          capacity: 10,
        },
        {
          date: "2026-10-23",
          id: ivan.id,
          name: "Ivan Coach",
          workouts: 1,
          minutes: 60,
          reserved: 0,
          capacity: 5,
        },
      ],
      studios: [
        {
          date: "2026-10-22",
          id: main.id,
          name: "Main hall",
          workouts: 2,
          minutes: 150,
          reserved: 3,
          capacity: 10,
        },
        {
          date: "2026-10-22",
          id: small.id,
          name: "Small room",
          workouts: 1,
          minutes: 60,
          reserved: 0,
          capacity: 10,
        },
        {
          date: "2026-10-23",
          id: main.id,
          name: "Main hall",
          workouts: 1,
          minutes: 60,
          reserved: 0,
          capacity: 5,
        },
      ],
    });
  });

  it("is empty for a range without workouts", async () => {
    const response = await call("GET", "/api/reports/load?from=2026-11-01&to=2026-11-07", "admin");

    expect(response.json()).toMatchObject({ coaches: [], studios: [] });
  });

  it("is hidden from coaches and limits the range to 92 days", async () => {
    expect(
      (await call("GET", "/api/reports/load?from=2026-10-22&to=2026-10-23", "coach")).statusCode,
    ).toBe(403);
    expect(
      (await call("GET", "/api/reports/load?from=2026-01-01&to=2026-12-31", "admin")).statusCode,
    ).toBe(400);
    expect(
      (await call("GET", "/api/reports/load?from=2026-10-23&to=2026-10-22", "admin")).statusCode,
    ).toBe(400);
  });
});
