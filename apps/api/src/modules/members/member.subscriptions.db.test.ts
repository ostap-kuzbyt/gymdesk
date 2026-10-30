import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { addDays } from "../../platform/dates.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { fixedClock } from "../../testing/test-clock.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

const TODAY = "2026-10-21";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;
let emailCounter = 0;

beforeAll(async () => {
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig(), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: fixedClock(`${TODAY}T09:00:00Z`),
  });
});

afterAll(async () => {
  await app.close();
  await testDb.dispose();
});

async function createTariff(name: string, overrides: Record<string, unknown> = {}) {
  const response = await app.inject({
    method: "POST",
    url: "/api/tariffs",
    headers: await auth.bearer(["admin"]),
    payload: { name, priceCents: 4900, durationDays: 30, ...overrides },
  });
  return response.json() as { id: string; version: number };
}

async function createMember() {
  emailCounter += 1;
  const response = await app.inject({
    method: "POST",
    url: "/api/members",
    headers: await auth.bearer(["reception"]),
    payload: {
      fullName: "Test Member",
      birthDate: "1990-01-01",
      email: `member${emailCounter}@example.com`,
    },
  });
  return response.json() as { id: string };
}

async function purchase(memberId: string, payload: Record<string, unknown>) {
  return app.inject({
    method: "POST",
    url: `/api/members/${memberId}/subscriptions`,
    headers: await auth.bearer(["reception"]),
    payload,
  });
}

describe("purchasing a subscription", () => {
  it("starts today by default and spans the tariff duration", async () => {
    const tariff = await createTariff("Monthly");
    const member = await createMember();

    const response = await purchase(member.id, { tariffId: tariff.id });

    expect(response.statusCode).toBe(201);
    expect(response.json().subscriptions).toEqual([
      expect.objectContaining({
        tariffId: tariff.id,
        startsOn: "2026-10-21",
        endsOn: "2026-11-19",
        priceCents: 4900,
        visitLimit: null,
        cancelledOn: null,
        status: "active",
      }),
    ]);
  });

  it("keeps the price and visit limit agreed at purchase when the tariff changes later", async () => {
    const tariff = await createTariff("Ten visits", { visitLimit: 10 });
    const member = await createMember();
    await purchase(member.id, { tariffId: tariff.id });

    await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${tariff.id}`,
      headers: await auth.bearer(["admin"]),
      payload: { version: tariff.version, priceCents: 9900, visitLimit: 5 },
    });

    const subscriptions = await app.inject({
      method: "GET",
      url: `/api/members/${member.id}/subscriptions`,
      headers: await auth.bearer(["reception"]),
    });
    expect(subscriptions.json()[0]).toMatchObject({ priceCents: 4900, visitLimit: 10 });
  });

  it("can start in the future and is then upcoming", async () => {
    const tariff = await createTariff("Quarter", { durationDays: 90 });
    const member = await createMember();

    const response = await purchase(member.id, { tariffId: tariff.id, startsOn: "2026-11-01" });

    expect(response.json().subscriptions[0]).toMatchObject({
      startsOn: "2026-11-01",
      endsOn: "2027-01-29",
      status: "upcoming",
    });
  });

  it("shows the end date in the member list while the subscription is active", async () => {
    const tariff = await createTariff("Listed");
    const member = await createMember();
    await purchase(member.id, { tariffId: tariff.id });

    const list = await app.inject({
      method: "GET",
      url: "/api/members?limit=100",
      headers: await auth.bearer(["admin"]),
    });
    const row = list.json().items.find((item: { id: string }) => item.id === member.id);

    expect(row.activeUntil).toBe("2026-11-19");
  });

  it("refuses overlapping subscriptions but accepts the day after the previous one ends", async () => {
    const tariff = await createTariff("Overlap check");
    const member = await createMember();
    await purchase(member.id, { tariffId: tariff.id });

    const overlapping = await purchase(member.id, { tariffId: tariff.id, startsOn: "2026-11-19" });
    expect(overlapping.statusCode).toBe(400);
    expect(overlapping.json().detail).toMatch(/overlaps/);

    const adjacent = await purchase(member.id, { tariffId: tariff.id, startsOn: "2026-11-20" });
    expect(adjacent.statusCode).toBe(201);
    expect(adjacent.json().subscriptions).toHaveLength(2);
  });

  it("refuses a start date in the past", async () => {
    const tariff = await createTariff("Backdated");
    const member = await createMember();

    const response = await purchase(member.id, { tariffId: tariff.id, startsOn: "2026-10-20" });

    expect(response.statusCode).toBe(400);
  });

  it("answers 404 for an unknown member or tariff and 400 for an archived tariff", async () => {
    const tariff = await createTariff("Soon archived");
    const member = await createMember();
    const unknownId = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b4444";

    expect((await purchase(unknownId, { tariffId: tariff.id })).statusCode).toBe(404);
    expect((await purchase(member.id, { tariffId: unknownId })).statusCode).toBe(404);

    await app.inject({
      method: "POST",
      url: `/api/tariffs/${tariff.id}/archive`,
      headers: await auth.bearer(["admin"]),
    });
    expect((await purchase(member.id, { tariffId: tariff.id })).statusCode).toBe(400);
  });

  it("answers 400 for a malformed body and 403 for coaches", async () => {
    const member = await createMember();

    expect((await purchase(member.id, { tariffId: "nope" })).statusCode).toBe(400);

    const coach = await app.inject({
      method: "POST",
      url: `/api/members/${member.id}/subscriptions`,
      headers: await auth.bearer(["coach"]),
      payload: { tariffId: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b4444" },
    });
    expect(coach.statusCode).toBe(403);
  });
});

describe("cancelling a subscription", () => {
  async function cancel(memberId: string, subscriptionId: string) {
    return app.inject({
      method: "POST",
      url: `/api/members/${memberId}/subscriptions/${subscriptionId}/cancel`,
      headers: await auth.bearer(["reception"]),
    });
  }

  it("marks it cancelled, removes the active end date and frees the period", async () => {
    const tariff = await createTariff("Cancellable");
    const member = await createMember();
    const bought = await purchase(member.id, { tariffId: tariff.id });
    const subscriptionId = bought.json().subscriptions[0].id;

    const response = await cancel(member.id, subscriptionId);

    expect(response.statusCode).toBe(200);
    expect(response.json().subscriptions[0]).toMatchObject({
      status: "cancelled",
      cancelledOn: TODAY,
    });

    const list = await app.inject({
      method: "GET",
      url: "/api/members?limit=100",
      headers: await auth.bearer(["admin"]),
    });
    const row = list.json().items.find((item: { id: string }) => item.id === member.id);
    expect(row.activeUntil).toBeNull();

    expect((await purchase(member.id, { tariffId: tariff.id })).statusCode).toBe(201);
  });

  it("answers 400 when cancelling twice and 404 for an unknown subscription", async () => {
    const tariff = await createTariff("Twice");
    const member = await createMember();
    const bought = await purchase(member.id, { tariffId: tariff.id });
    const subscriptionId = bought.json().subscriptions[0].id;

    await cancel(member.id, subscriptionId);

    expect((await cancel(member.id, subscriptionId)).statusCode).toBe(400);
    expect((await cancel(member.id, "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5555")).statusCode).toBe(404);
  });
});

describe("concurrent purchases", () => {
  it("lets only one of two simultaneous overlapping purchases through", async () => {
    const tariff = await createTariff("Race");
    const member = await createMember();

    const results = await Promise.all([
      purchase(member.id, { tariffId: tariff.id }),
      purchase(member.id, { tariffId: tariff.id }),
    ]);

    const statuses = results.map((result) => result.statusCode).sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);

    const stored = await app.inject({
      method: "GET",
      url: `/api/members/${member.id}/subscriptions`,
      headers: await auth.bearer(["admin"]),
    });
    expect(stored.json()).toHaveLength(1);
  });
});

describe("members that are about to expire", () => {
  async function expiring(days: number, role: "admin" | "reception" = "admin") {
    const response = await app.inject({
      method: "GET",
      url: `/api/members?expiringWithinDays=${days}&limit=100`,
      headers: await auth.bearer([role]),
    });
    return response.json() as {
      items: { id: string; fullName: string; activeUntil: string }[];
      total: number;
    };
  }

  it("lists members whose active subscription ends within the window, leaving out the rest", async () => {
    const soon = await createMember();
    await purchase(soon.id, {
      tariffId: (await createTariff("Five days", { durationDays: 5 })).id,
    });

    const later = await createMember();
    await purchase(later.id, {
      tariffId: (await createTariff("Long one", { durationDays: 40 })).id,
    });

    const renewed = await createMember();
    const short = await createTariff("Short renewable", { durationDays: 5 });
    await purchase(renewed.id, { tariffId: short.id });
    await purchase(renewed.id, { tariffId: short.id, startsOn: addDays(TODAY, 5) });

    const upcoming = await createMember();
    await purchase(upcoming.id, { tariffId: short.id, startsOn: addDays(TODAY, 3) });

    const cancelled = await createMember();
    const bought = await purchase(cancelled.id, { tariffId: short.id });
    await app.inject({
      method: "POST",
      url: `/api/members/${cancelled.id}/subscriptions/${bought.json().subscriptions[0].id}/cancel`,
      headers: await auth.bearer(["reception"]),
    });

    await createMember();

    const result = await expiring(7);

    expect(result.items.map((item) => item.id)).toEqual([soon.id]);
    expect(result.total).toBe(1);
    expect(result.items[0]?.activeUntil).toBe(addDays(TODAY, 4));
  });

  it("widens with the window and is readable by the front desk", async () => {
    const member = await createMember();
    await purchase(member.id, {
      tariffId: (await createTariff("Twenty days", { durationDays: 20 })).id,
    });

    expect((await expiring(7)).items.map((item) => item.id)).not.toContain(member.id);
    expect((await expiring(30, "reception")).items.map((item) => item.id)).toContain(member.id);
  });

  it("combines with the search term", async () => {
    const member = await createMember();
    await purchase(member.id, { tariffId: (await createTariff("Quick", { durationDays: 3 })).id });

    const response = await app.inject({
      method: "GET",
      url: "/api/members?expiringWithinDays=7&q=no-such-person",
      headers: await auth.bearer(["admin"]),
    });

    expect(response.json().total).toBe(0);
  });

  it("rejects a window outside 1 to 60 days", async () => {
    for (const days of [0, 61, "abc"]) {
      const response = await app.inject({
        method: "GET",
        url: `/api/members?expiringWithinDays=${days}`,
        headers: await auth.bearer(["admin"]),
      });
      expect(response.statusCode).toBe(400);
    }
  });
});
