import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;

beforeAll(async () => {
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig(), { db: testDb.db, verifier: auth.verifier });
});

afterAll(async () => {
  await app.close();
  await testDb.dispose();
});

async function createTariff(name: string, overrides: Record<string, unknown> = {}) {
  return app.inject({
    method: "POST",
    url: "/api/tariffs",
    headers: await auth.bearer(["admin"]),
    payload: { name, priceCents: 4900, durationDays: 30, ...overrides },
  });
}

describe("access", () => {
  it("rejects anonymous requests", async () => {
    const response = await app.inject({ method: "GET", url: "/api/tariffs" });

    expect(response.statusCode).toBe(401);
  });

  it("lets every staff role read but only admins write", async () => {
    for (const role of ["admin", "reception", "coach"] as const) {
      const response = await app.inject({
        method: "GET",
        url: "/api/tariffs",
        headers: await auth.bearer([role]),
      });
      expect(response.statusCode).toBe(200);
    }

    const denied = await app.inject({
      method: "POST",
      url: "/api/tariffs",
      headers: await auth.bearer(["reception"]),
      payload: { name: "Sneaky", priceCents: 1, durationDays: 1 },
    });
    expect(denied.statusCode).toBe(403);
  });
});

describe("create and read", () => {
  it("creates a tariff with unlimited visits by default", async () => {
    const response = await createTariff("Monthly");

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: "Monthly",
      priceCents: 4900,
      durationDays: 30,
      visitLimit: null,
      archived: false,
      version: 1,
    });

    const fetched = await app.inject({
      method: "GET",
      url: `/api/tariffs/${response.json().id}`,
      headers: await auth.bearer(["coach"]),
    });
    expect(fetched.json()).toEqual(response.json());
  });

  it("answers 400 with field details for an invalid body", async () => {
    const response = await createTariff("x", { priceCents: -5 });

    expect(response.statusCode).toBe(400);
    expect(response.json().errors.map((error: { path: string }) => error.path)).toEqual(
      expect.arrayContaining(["name", "priceCents"]),
    );
  });

  it("answers 409 when an active tariff already has that name", async () => {
    await createTariff("Quarterly");

    const duplicate = await createTariff("quarterly");

    expect(duplicate.statusCode).toBe(409);
  });

  it("answers 404 for an unknown id and 400 for a malformed one", async () => {
    const headers = await auth.bearer(["admin"]);

    const unknown = await app.inject({
      method: "GET",
      url: "/api/tariffs/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1111",
      headers,
    });
    const malformed = await app.inject({ method: "GET", url: "/api/tariffs/nope", headers });

    expect(unknown.statusCode).toBe(404);
    expect(malformed.statusCode).toBe(400);
  });
});

describe("update", () => {
  it("applies changes and bumps the version", async () => {
    const created = (await createTariff("Student")).json();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${created.id}`,
      headers: await auth.bearer(["admin"]),
      payload: { version: created.version, priceCents: 3500, visitLimit: 12 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Student",
      priceCents: 3500,
      visitLimit: 12,
      version: 2,
    });
  });

  it("answers 409 when the version is stale", async () => {
    const created = (await createTariff("Corporate")).json();
    const headers = await auth.bearer(["admin"]);

    await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${created.id}`,
      headers,
      payload: { version: 1, priceCents: 5000 },
    });
    const stale = await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${created.id}`,
      headers,
      payload: { version: 1, priceCents: 6000 },
    });

    expect(stale.statusCode).toBe(409);
  });

  it("answers 400 when the change breaks a pricing rule", async () => {
    const created = (await createTariff("Weekend")).json();

    const response = await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${created.id}`,
      headers: await auth.bearer(["admin"]),
      payload: { version: 1, durationDays: 1000 },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("archive", () => {
  it("hides the tariff from the default list, frees its name and blocks edits", async () => {
    const created = (await createTariff("Seasonal")).json();
    const headers = await auth.bearer(["admin"]);

    const archived = await app.inject({
      method: "POST",
      url: `/api/tariffs/${created.id}/archive`,
      headers,
    });
    expect(archived.json()).toMatchObject({ archived: true, version: 2 });

    const defaultList = await app.inject({ method: "GET", url: "/api/tariffs", headers });
    const fullList = await app.inject({
      method: "GET",
      url: "/api/tariffs?includeArchived=true",
      headers,
    });
    const ids = (response: { json: () => { id: string }[] }) =>
      response.json().map((tariff) => tariff.id);
    expect(ids(defaultList)).not.toContain(created.id);
    expect(ids(fullList)).toContain(created.id);

    expect((await createTariff("Seasonal")).statusCode).toBe(201);

    const edit = await app.inject({
      method: "PATCH",
      url: `/api/tariffs/${created.id}`,
      headers,
      payload: { version: 2, priceCents: 1 },
    });
    expect(edit.statusCode).toBe(400);
  });
});
