import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { fixedClock } from "../../testing/test-clock.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

type Role = "admin" | "reception" | "coach";

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  from: "06:00",
  to: "22:00",
}));
const WEEK = "from=2026-10-20&to=2026-10-30";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;

let coachA: string;
let coachB: string;
let memberOfA: string;
let memberOfB: string;
let memberOfNobody: string;
let workoutOfA: string;
let workoutOfB: string;

beforeAll(async () => {
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig(), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: fixedClock("2026-10-21T09:00:00Z"),
  });

  const studio = (
    await call("POST", "/api/studios", "admin", { name: "Hall", capacity: 20 })
  ).json();
  coachA = (await newCoach("Anna Coach", "auth0|coach-a")).id;
  coachB = (await newCoach("Boris Coach", "auth0|coach-b")).id;
  memberOfA = (await newMember("Member Of A", coachA)).id;
  memberOfB = (await newMember("Member Of B", coachB)).id;
  memberOfNobody = (await newMember("Member Of Nobody", null)).id;
  workoutOfA = (await newWorkout(studio.id, coachA, "09:00", "Class A")).id;
  workoutOfB = (await newWorkout(studio.id, coachB, "11:00", "Class B")).id;
});

afterAll(async () => {
  await app.close();
  await testDb.dispose();
});

async function call(
  method: "GET" | "POST" | "PUT",
  url: string,
  role: Role,
  payload?: unknown,
  subject?: string,
) {
  return app.inject({
    method,
    url,
    headers: await auth.bearer([role], subject),
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

async function newCoach(fullName: string, authSubject: string) {
  const response = await call("POST", "/api/coaches", "admin", {
    fullName,
    specialization: "Fitness",
    weeklyHours: EVERY_DAY,
    authSubject,
  });
  return response.json() as { id: string };
}

let emailCounter = 0;

async function newMember(fullName: string, coachId: string | null) {
  emailCounter += 1;
  const created = await call("POST", "/api/members", "reception", {
    fullName,
    birthDate: "1990-01-01",
    email: `scope${emailCounter}@example.com`,
  });
  const member = created.json() as { id: string };
  if (coachId) await call("PUT", `/api/members/${member.id}/coach`, "reception", { coachId });
  return member;
}

async function newWorkout(studioId: string, coachId: string, startTime: string, title: string) {
  const response = await call("POST", "/api/workouts", "reception", {
    title,
    kind: "group",
    studioId,
    coachId,
    date: "2026-10-22",
    startTime,
    endTime: `${String(Number(startTime.slice(0, 2)) + 1).padStart(2, "0")}:00`,
    capacity: 5,
  });
  return response.json() as { id: string };
}

const asCoachA = (url: string) => call("GET", url, "coach", undefined, "auth0|coach-a");
const asStranger = (url: string) => call("GET", url, "coach", undefined, "auth0|nobody-linked");

describe("a coach with a linked account", () => {
  it("lists only the members assigned to them", async () => {
    const response = await asCoachA("/api/members");

    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(1);
    expect(response.json().items.map((item: { id: string }) => item.id)).toEqual([memberOfA]);
  });

  it("opens their own member and is refused anyone else's", async () => {
    expect((await asCoachA(`/api/members/${memberOfA}`)).statusCode).toBe(200);
    expect((await asCoachA(`/api/members/${memberOfA}/subscriptions`)).statusCode).toBe(200);
    expect((await asCoachA(`/api/members/${memberOfA}/check-ins`)).statusCode).toBe(200);

    for (const other of [memberOfB, memberOfNobody]) {
      expect((await asCoachA(`/api/members/${other}`)).statusCode).toBe(403);
      expect((await asCoachA(`/api/members/${other}/subscriptions`)).statusCode).toBe(403);
      expect((await asCoachA(`/api/members/${other}/check-ins`)).statusCode).toBe(403);
    }
  });

  it("reads their own member list and not another coach's", async () => {
    expect((await asCoachA(`/api/coaches/${coachA}/members`)).statusCode).toBe(200);
    expect((await asCoachA(`/api/coaches/${coachB}/members`)).statusCode).toBe(403);
  });

  it("sees only their own workouts, even when the query asks for another coach", async () => {
    const own = await asCoachA(`/api/workouts?${WEEK}`);
    expect(own.json().map((item: { id: string }) => item.id)).toEqual([workoutOfA]);

    const forced = await asCoachA(`/api/workouts?${WEEK}&coachId=${coachB}`);
    expect(forced.json().map((item: { id: string }) => item.id)).toEqual([workoutOfA]);
  });

  it("opens their own workout and is refused another coach's", async () => {
    expect((await asCoachA(`/api/workouts/${workoutOfA}`)).statusCode).toBe(200);
    expect((await asCoachA(`/api/workouts/${workoutOfB}`)).statusCode).toBe(403);
  });

  it("still cannot do front desk work", async () => {
    const checkIn = await call(
      "POST",
      `/api/members/${memberOfA}/check-ins`,
      "coach",
      undefined,
      "auth0|coach-a",
    );
    expect(checkIn.statusCode).toBe(403);
  });
});

describe("a coach whose account is not linked to a profile", () => {
  it("sees nothing", async () => {
    expect((await asStranger("/api/members")).json()).toEqual({ items: [], total: 0 });
    expect((await asStranger(`/api/workouts?${WEEK}`)).json()).toEqual([]);
    expect((await asStranger(`/api/members/${memberOfNobody}`)).statusCode).toBe(403);
    expect((await asStranger(`/api/workouts/${workoutOfA}`)).statusCode).toBe(403);
  });
});

describe("reception and admin", () => {
  it("keep seeing the whole club", async () => {
    for (const role of ["reception", "admin"] as const) {
      const members = await call("GET", "/api/members", role);
      expect(members.json().total).toBe(3);

      const workouts = await call("GET", `/api/workouts?${WEEK}`, role);
      expect(workouts.json()).toHaveLength(2);

      expect((await call("GET", `/api/members/${memberOfB}`, role)).statusCode).toBe(200);
      expect((await call("GET", `/api/workouts/${workoutOfB}`, role)).statusCode).toBe(200);
    }
  });
});

describe("GET /api/me", () => {
  it("needs a token", async () => {
    expect((await app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
  });

  it("names the linked coach profile", async () => {
    const response = await asCoachA("/api/me");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      subject: "auth0|coach-a",
      roles: ["coach"],
      coachId: coachA,
    });
  });

  it("answers null for an account that is not linked", async () => {
    expect((await asStranger("/api/me")).json()).toMatchObject({ coachId: null });
    expect((await call("GET", "/api/me", "admin")).json()).toMatchObject({
      roles: ["admin"],
      coachId: null,
    });
  });
});
