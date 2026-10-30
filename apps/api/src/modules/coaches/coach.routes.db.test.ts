import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { fixedClock } from "../../testing/test-clock.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

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
    clock: fixedClock("2026-10-21T09:00:00Z"),
  });
});

afterAll(async () => {
  await app.close();
  await testDb.dispose();
});

async function createCoach(overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/coaches",
    headers: await auth.bearer(["admin"]),
    payload: { fullName: "Ivan Petrenko", specialization: "Strength training", ...overrides },
  });
}

async function createMember(fullName = "Member") {
  emailCounter += 1;
  const response = await app.inject({
    method: "POST",
    url: "/api/members",
    headers: await auth.bearer(["reception"]),
    payload: { fullName, birthDate: "1990-01-01", email: `m${emailCounter}@example.com` },
  });
  return response.json() as { id: string };
}

async function assign(memberId: string, coachId: string | null) {
  return app.inject({
    method: "PUT",
    url: `/api/members/${memberId}/coach`,
    headers: await auth.bearer(["reception"]),
    payload: { coachId },
  });
}

describe("coach sign-in accounts", () => {
  it("stores the account id, shows it to admins only and finds the coach by it", async () => {
    const created = await createCoach({ authSubject: "auth0|account-one" });
    expect(created.statusCode).toBe(201);
    expect(created.json().authSubject).toBe("auth0|account-one");

    const read = async (roles: ("admin" | "reception" | "coach")[]) =>
      (
        await app.inject({
          method: "GET",
          url: `/api/coaches/${created.json().id}`,
          headers: await auth.bearer(roles),
        })
      ).json();
    expect((await read(["admin"])).authSubject).toBe("auth0|account-one");
    expect((await read(["reception"])).authSubject).toBeNull();
    expect((await read(["coach"])).authSubject).toBeNull();

    const list = await app.inject({
      method: "GET",
      url: "/api/coaches",
      headers: await auth.bearer(["coach"]),
    });
    expect(
      list.json().every((coach: { authSubject: string | null }) => coach.authSubject === null),
    ).toBe(true);
  });

  it("refuses the same account on two coaches with 409", async () => {
    await createCoach({ fullName: "First Holder", authSubject: "auth0|shared" });
    const second = await createCoach({ fullName: "Second Holder", authSubject: "auth0|shared" });
    expect(second.statusCode).toBe(409);
  });

  it("links, relinks and clears the account through a patch", async () => {
    const created = (await createCoach()).json();
    const patch = async (version: number, authSubject: string | null) =>
      app.inject({
        method: "PATCH",
        url: `/api/coaches/${created.id}`,
        headers: await auth.bearer(["admin"]),
        payload: { version, authSubject },
      });

    const linked = await patch(1, "auth0|patched");
    expect(linked.json()).toMatchObject({ authSubject: "auth0|patched", version: 2 });

    const cleared = await patch(2, null);
    expect(cleared.json()).toMatchObject({ authSubject: null, version: 3 });
  });

  it("answers 400 for an account id with spaces", async () => {
    expect((await createCoach({ authSubject: "auth0|a b" })).statusCode).toBe(400);
  });
});

describe("coach profiles", () => {
  it("lets staff read and only admins write", async () => {
    expect((await app.inject({ method: "GET", url: "/api/coaches" })).statusCode).toBe(401);

    const coachRead = await app.inject({
      method: "GET",
      url: "/api/coaches",
      headers: await auth.bearer(["coach"]),
    });
    expect(coachRead.statusCode).toBe(200);

    const receptionWrite = await app.inject({
      method: "POST",
      url: "/api/coaches",
      headers: await auth.bearer(["reception"]),
      payload: { fullName: "Sneaky Person", specialization: "Anything" },
    });
    expect(receptionWrite.statusCode).toBe(403);
  });

  it("creates a coach with sorted working hours and reads it back", async () => {
    const created = await createCoach({
      weeklyHours: [
        { weekday: 3, from: "14:00", to: "18:00" },
        { weekday: 1, from: "08:00", to: "12:00" },
      ],
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      fullName: "Ivan Petrenko",
      weeklyHours: [
        { weekday: 1, from: "08:00", to: "12:00" },
        { weekday: 3, from: "14:00", to: "18:00" },
      ],
      archived: false,
      version: 1,
    });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/coaches/${created.json().id}`,
      headers: await auth.bearer(["coach"]),
    });
    expect(fetched.json()).toEqual(created.json());
  });

  it("answers 400 for invalid hours, including overlaps that only the domain catches", async () => {
    const badTime = await createCoach({ weeklyHours: [{ weekday: 1, from: "8:00", to: "12:00" }] });
    expect(badTime.statusCode).toBe(400);

    const overlap = await createCoach({
      weeklyHours: [
        { weekday: 2, from: "08:00", to: "12:00" },
        { weekday: 2, from: "11:00", to: "14:00" },
      ],
    });
    expect(overlap.statusCode).toBe(400);
    expect(overlap.json().detail).toMatch(/overlap/);
  });

  it("answers 404 for an unknown coach", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/coaches/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b8888",
      headers: await auth.bearer(["admin"]),
    });

    expect(response.statusCode).toBe(404);
  });

  it("updates with optimistic versioning", async () => {
    const created = (await createCoach()).json();
    const headers = await auth.bearer(["admin"]);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/coaches/${created.id}`,
      headers,
      payload: {
        version: 1,
        specialization: "Yoga",
        weeklyHours: [{ weekday: 6, from: "10:00", to: "14:00" }],
      },
    });
    expect(updated.json()).toMatchObject({
      specialization: "Yoga",
      weeklyHours: [{ weekday: 6, from: "10:00", to: "14:00" }],
      version: 2,
    });

    const stale = await app.inject({
      method: "PATCH",
      url: `/api/coaches/${created.id}`,
      headers,
      payload: { version: 1, specialization: "Pilates" },
    });
    expect(stale.statusCode).toBe(409);
  });

  it("archives a coach, hides it from the default list and blocks edits", async () => {
    const created = (await createCoach({ fullName: "Archived Coach" })).json();
    const headers = await auth.bearer(["admin"]);

    await app.inject({ method: "POST", url: `/api/coaches/${created.id}/archive`, headers });

    const list = await app.inject({ method: "GET", url: "/api/coaches", headers });
    const withArchived = await app.inject({
      method: "GET",
      url: "/api/coaches?includeArchived=true",
      headers,
    });
    expect(list.json().map((coach: { id: string }) => coach.id)).not.toContain(created.id);
    expect(withArchived.json().map((coach: { id: string }) => coach.id)).toContain(created.id);

    const edit = await app.inject({
      method: "PATCH",
      url: `/api/coaches/${created.id}`,
      headers,
      payload: { version: 2, specialization: "Too late" },
    });
    expect(edit.statusCode).toBe(400);
  });
});

describe("assigned members", () => {
  it("assigns members to a coach and lists them with search and pagination", async () => {
    const coach = (await createCoach({ fullName: "Olha Koval" })).json();
    const other = (await createCoach({ fullName: "Other Coach" })).json();
    const anna = await createMember("Anna Client");
    const boris = await createMember("Boris Client");
    const stranger = await createMember("Stranger");

    const assigned = await assign(anna.id, coach.id);
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toMatchObject({ coachId: coach.id, version: 2 });
    await assign(boris.id, coach.id);
    await assign(stranger.id, other.id);

    const headers = await auth.bearer(["reception"]);
    const all = await app.inject({
      method: "GET",
      url: `/api/coaches/${coach.id}/members`,
      headers,
    });
    expect(all.json().total).toBe(2);
    expect(all.json().items.map((item: { fullName: string }) => item.fullName)).toEqual([
      "Anna Client",
      "Boris Client",
    ]);

    const filtered = await app.inject({
      method: "GET",
      url: `/api/coaches/${coach.id}/members?q=boris`,
      headers,
    });
    expect(filtered.json().items).toHaveLength(1);

    const paged = await app.inject({
      method: "GET",
      url: `/api/coaches/${coach.id}/members?limit=1&offset=1`,
      headers,
    });
    expect(paged.json()).toMatchObject({ total: 2, items: [{ fullName: "Boris Client" }] });
  });

  it("moves a member between coaches and clears the assignment", async () => {
    const first = (await createCoach({ fullName: "First Coach" })).json();
    const second = (await createCoach({ fullName: "Second Coach" })).json();
    const member = await createMember();

    await assign(member.id, first.id);
    expect((await assign(member.id, second.id)).json().coachId).toBe(second.id);
    expect((await assign(member.id, null)).json().coachId).toBeNull();

    const headers = await auth.bearer(["admin"]);
    const members = await app.inject({
      method: "GET",
      url: `/api/coaches/${second.id}/members`,
      headers,
    });
    expect(members.json().items.map((item: { id: string }) => item.id)).not.toContain(member.id);
  });

  it("refuses unknown or archived coaches and unknown members", async () => {
    const coach = (await createCoach({ fullName: "Soon Gone" })).json();
    const member = await createMember();

    expect((await assign(member.id, "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b9999")).statusCode).toBe(404);
    expect((await assign("6f1d7a52-2f0f-4a43-9a53-5d9b1a9b9998", coach.id)).statusCode).toBe(404);

    await app.inject({
      method: "POST",
      url: `/api/coaches/${coach.id}/archive`,
      headers: await auth.bearer(["admin"]),
    });
    expect((await assign(member.id, coach.id)).statusCode).toBe(400);
  });

  it("answers 404 when listing members of an unknown coach and 403 when a coach assigns", async () => {
    const missing = await app.inject({
      method: "GET",
      url: "/api/coaches/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b9997/members",
      headers: await auth.bearer(["admin"]),
    });
    expect(missing.statusCode).toBe(404);

    const member = await createMember();
    const forbidden = await app.inject({
      method: "PUT",
      url: `/api/members/${member.id}/coach`,
      headers: await auth.bearer(["coach"]),
      payload: { coachId: null },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});
