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

async function register(overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/members",
    headers: await auth.bearer(["reception"]),
    payload: {
      fullName: "Olena Shevchenko",
      birthDate: "1994-05-17",
      email: "olena@example.com",
      ...overrides,
    },
  });
}

async function search(query: string, roles: ("admin" | "reception" | "coach")[] = ["admin"]) {
  const response = await app.inject({
    method: "GET",
    url: `/api/members${query}`,
    headers: await auth.bearer(roles),
  });
  return response.json() as {
    items: { id: string; fullName: string; age: number; activeUntil: string | null }[];
    total: number;
  };
}

describe("access", () => {
  it("rejects anonymous callers and lets coaches read but not write", async () => {
    expect((await app.inject({ method: "GET", url: "/api/members" })).statusCode).toBe(401);

    const coachRead = await app.inject({
      method: "GET",
      url: "/api/members",
      headers: await auth.bearer(["coach"]),
    });
    expect(coachRead.statusCode).toBe(200);

    const coachWrite = await app.inject({
      method: "POST",
      url: "/api/members",
      headers: await auth.bearer(["coach"]),
      payload: { fullName: "Nope", birthDate: "1990-01-01", email: "nope@example.com" },
    });
    expect(coachWrite.statusCode).toBe(403);
  });
});

describe("registration", () => {
  it("registers a member with a normalised profile, an age and no subscriptions", async () => {
    const response = await register({
      email: "  Reg.Ister@Example.COM ",
      phone: "+380501234567",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      fullName: "Olena Shevchenko",
      email: "reg.ister@example.com",
      phone: "+380501234567",
      age: 32,
      version: 1,
      subscriptions: [],
    });
  });

  it("stores no phone when none is given", async () => {
    const response = await register({ email: "nophone@example.com" });

    expect(response.json().phone).toBeNull();
  });

  it("answers 409 for a duplicate email regardless of case", async () => {
    await register({ email: "dup@example.com" });

    expect((await register({ email: "DUP@example.com" })).statusCode).toBe(409);
  });

  it("answers 400 for malformed input and for a member who is too young", async () => {
    const badEmail = await register({ email: "not-an-email" });
    expect(badEmail.statusCode).toBe(400);
    expect(badEmail.json().errors.map((error: { path: string }) => error.path)).toContain("email");

    const badPhone = await register({ email: "p@example.com", phone: "12345" });
    expect(badPhone.statusCode).toBe(400);

    const tooYoung = await register({ email: "kid@example.com", birthDate: "2020-01-01" });
    expect(tooYoung.statusCode).toBe(400);
    expect(tooYoung.json().detail).toMatch(/years old/);
  });
});

describe("read and update", () => {
  it("returns a registered member and 404 for an unknown id", async () => {
    const created = (await register({ email: "read@example.com" })).json();
    const headers = await auth.bearer(["coach"]);

    const found = await app.inject({ method: "GET", url: `/api/members/${created.id}`, headers });
    expect(found.json()).toEqual(created);

    const missing = await app.inject({
      method: "GET",
      url: "/api/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b3333",
      headers,
    });
    expect(missing.statusCode).toBe(404);
  });

  it("updates the profile and bumps the version", async () => {
    const created = (
      await register({ email: "update@example.com", phone: "+380501234567" })
    ).json();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/members/${created.id}`,
      headers: await auth.bearer(["reception"]),
      payload: { version: 1, fullName: "Olena Kovalenko", phone: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      fullName: "Olena Kovalenko",
      phone: null,
      email: "update@example.com",
      version: 2,
    });
  });

  it("answers 409 for a stale version and for an email that is already taken", async () => {
    const first = (await register({ email: "first@example.com" })).json();
    await register({ email: "taken@example.com" });
    const headers = await auth.bearer(["admin"]);

    await app.inject({
      method: "PATCH",
      url: `/api/members/${first.id}`,
      headers,
      payload: { version: 1, fullName: "First Changed" },
    });
    const stale = await app.inject({
      method: "PATCH",
      url: `/api/members/${first.id}`,
      headers,
      payload: { version: 1, fullName: "Second Change" },
    });
    expect(stale.statusCode).toBe(409);

    const taken = await app.inject({
      method: "PATCH",
      url: `/api/members/${first.id}`,
      headers,
      payload: { version: 2, email: "taken@example.com" },
    });
    expect(taken.statusCode).toBe(409);
  });
});

describe("search", () => {
  beforeAll(async () => {
    await register({
      fullName: "Andriy Bondar",
      email: "andriy.b@example.com",
      phone: "+380671110001",
    });
    await register({
      fullName: "Bohdana Melnyk",
      email: "bohdana@example.com",
      phone: "+380671110002",
    });
    await register({ fullName: "Hundred% Sure", email: "percent@example.com" });
  });

  it("matches the name, email or phone case-insensitively", async () => {
    expect((await search("?q=ANDRIY")).items.map((item) => item.fullName)).toEqual([
      "Andriy Bondar",
    ]);
    expect((await search("?q=bohdana@")).items).toHaveLength(1);
    expect((await search("?q=0671110002")).items.map((item) => item.fullName)).toEqual([
      "Bohdana Melnyk",
    ]);
  });

  it("treats wildcard characters literally", async () => {
    const result = await search(`?q=${encodeURIComponent("%")}`);

    expect(result.items.map((item) => item.fullName)).toEqual(["Hundred% Sure"]);
  });

  it("orders by name, paginates and reports the total", async () => {
    const firstPage = await search("?limit=2&offset=0");
    const secondPage = await search("?limit=2&offset=2");

    const names = firstPage.items.map((item) => item.fullName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBeGreaterThan(4);
    expect(secondPage.total).toBe(firstPage.total);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
  });

  it("includes the age and no active subscription for new members", async () => {
    const [item] = (await search("?q=Andriy")).items;

    expect(item).toMatchObject({ age: expect.any(Number), activeUntil: null });
  });

  it("rejects an out-of-range page size", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/members?limit=1000",
      headers: await auth.bearer(["admin"]),
    });

    expect(response.statusCode).toBe(400);
  });
});
