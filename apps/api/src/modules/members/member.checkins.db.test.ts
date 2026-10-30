import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createClock } from "../../platform/clock.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;
let instant = new Date("2026-10-21T09:00:00Z");
let emailCounter = 0;

function goTo(day: string, time = "09:00:00Z"): void {
  instant = new Date(`${day}T${time}`);
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

async function createMember() {
  emailCounter += 1;
  const response = await app.inject({
    method: "POST",
    url: "/api/members",
    headers: await auth.bearer(["reception"]),
    payload: {
      fullName: "Visitor",
      birthDate: "1990-01-01",
      email: `visitor${emailCounter}@example.com`,
    },
  });
  return response.json() as { id: string };
}

async function subscribe(memberId: string, tariff: Record<string, unknown>, startsOn?: string) {
  emailCounter += 1;
  const created = await app.inject({
    method: "POST",
    url: "/api/tariffs",
    headers: await auth.bearer(["admin"]),
    payload: { name: `Tariff ${emailCounter}`, priceCents: 3000, durationDays: 30, ...tariff },
  });
  const response = await app.inject({
    method: "POST",
    url: `/api/members/${memberId}/subscriptions`,
    headers: await auth.bearer(["reception"]),
    payload: { tariffId: created.json().id, ...(startsOn ? { startsOn } : {}) },
  });
  return response.json().subscriptions.at(-1) as { id: string };
}

async function checkIn(
  memberId: string,
  roles: ("admin" | "reception" | "coach")[] = ["reception"],
) {
  return app.inject({
    method: "POST",
    url: `/api/members/${memberId}/check-ins`,
    headers: await auth.bearer(roles),
  });
}

describe("checking in", () => {
  it("records the visit against the active subscription with the arrival time", async () => {
    goTo("2026-10-21", "09:15:30Z");
    const member = await createMember();
    const subscription = await subscribe(member.id, {});

    const response = await checkIn(member.id);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      memberId: member.id,
      subscriptionId: subscription.id,
      visitDate: "2026-10-21",
      checkedInAt: "2026-10-21T09:15:30.000Z",
    });
  });

  it("answers 409 for a second check-in on the same day and accepts the next day", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, {});

    await checkIn(member.id);
    expect((await checkIn(member.id)).statusCode).toBe(409);

    goTo("2026-10-22");
    expect((await checkIn(member.id)).statusCode).toBe(201);
  });

  it("refuses a member without a subscription or with only an upcoming one", async () => {
    goTo("2026-10-21");
    const none = await createMember();
    const response = await checkIn(none.id);
    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toMatch(/no active subscription/);

    const upcoming = await createMember();
    await subscribe(upcoming.id, {}, "2026-11-05");
    expect((await checkIn(upcoming.id)).statusCode).toBe(400);
  });

  it("refuses a member whose subscription has ended", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, { durationDays: 3 });

    goTo("2026-10-24");
    expect((await checkIn(member.id)).statusCode).toBe(400);
  });

  it("refuses a member whose subscription was cancelled", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    const subscription = await subscribe(member.id, {});
    await app.inject({
      method: "POST",
      url: `/api/members/${member.id}/subscriptions/${subscription.id}/cancel`,
      headers: await auth.bearer(["reception"]),
    });

    expect((await checkIn(member.id)).statusCode).toBe(400);
  });

  it("stops at the visit limit of the subscription", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, { visitLimit: 2 });

    expect((await checkIn(member.id)).statusCode).toBe(201);
    goTo("2026-10-22");
    expect((await checkIn(member.id)).statusCode).toBe(201);
    goTo("2026-10-23");
    const third = await checkIn(member.id);

    expect(third.statusCode).toBe(400);
    expect(third.json().detail).toMatch(/visit limit/);
  });

  it("supports a single-visit tariff that is spent after one check-in", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, { durationDays: 1, visitLimit: 1 });

    expect((await checkIn(member.id)).statusCode).toBe(201);
    goTo("2026-10-22");
    expect((await checkIn(member.id)).statusCode).toBe(400);
  });

  it("answers 404 for an unknown member and 403 for coaches", async () => {
    goTo("2026-10-21");
    const member = await createMember();

    expect((await checkIn("6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6666")).statusCode).toBe(404);
    expect((await checkIn(member.id, ["coach"])).statusCode).toBe(403);
  });

  it("lets only one of two simultaneous check-ins through", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, {});

    const results = await Promise.all([checkIn(member.id), checkIn(member.id)]);

    expect(results.map((result) => result.statusCode).sort()).toEqual([201, 409]);
  });
});

describe("visit history", () => {
  it("lists visits newest first with a total and pagination", async () => {
    goTo("2026-10-21");
    const member = await createMember();
    await subscribe(member.id, { durationDays: 10 });
    for (const day of ["2026-10-21", "2026-10-22", "2026-10-23"]) {
      goTo(day);
      await checkIn(member.id);
    }

    const headers = await auth.bearer(["reception"]);
    const first = await app.inject({
      method: "GET",
      url: `/api/members/${member.id}/check-ins?limit=2`,
      headers,
    });
    const rest = await app.inject({
      method: "GET",
      url: `/api/members/${member.id}/check-ins?limit=2&offset=2`,
      headers,
    });

    expect(first.json().total).toBe(3);
    expect(first.json().items.map((item: { visitDate: string }) => item.visitDate)).toEqual([
      "2026-10-23",
      "2026-10-22",
    ]);
    expect(rest.json().items.map((item: { visitDate: string }) => item.visitDate)).toEqual([
      "2026-10-21",
    ]);
  });

  it("is empty for a member who never visited and 404 for an unknown member", async () => {
    const member = await createMember();
    const headers = await auth.bearer(["reception"]);

    const empty = await app.inject({
      method: "GET",
      url: `/api/members/${member.id}/check-ins`,
      headers,
    });
    expect(empty.json()).toEqual({ items: [], total: 0 });

    const missing = await app.inject({
      method: "GET",
      url: "/api/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7777/check-ins",
      headers,
    });
    expect(missing.statusCode).toBe(404);
  });
});
