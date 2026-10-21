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

async function createStudio(name: string, capacity = 20) {
  return app.inject({
    method: "POST",
    url: "/api/studios",
    headers: await auth.bearer(["admin"]),
    payload: { name, capacity },
  });
}

describe("studios api", () => {
  it("lets staff read and admins write", async () => {
    const anonymous = await app.inject({ method: "GET", url: "/api/studios" });
    expect(anonymous.statusCode).toBe(401);

    const coachRead = await app.inject({
      method: "GET",
      url: "/api/studios",
      headers: await auth.bearer(["coach"]),
    });
    expect(coachRead.statusCode).toBe(200);

    const receptionWrite = await app.inject({
      method: "POST",
      url: "/api/studios",
      headers: await auth.bearer(["reception"]),
      payload: { name: "Sneaky", capacity: 5 },
    });
    expect(receptionWrite.statusCode).toBe(403);
  });

  it("creates, reads and lists a studio ordered by name", async () => {
    const zumba = await createStudio("Zumba floor", 30);
    await createStudio("Aerobics hall", 18);

    expect(zumba.statusCode).toBe(201);
    expect(zumba.json()).toMatchObject({ name: "Zumba floor", capacity: 30, version: 1 });

    const headers = await auth.bearer(["reception"]);
    const fetched = await app.inject({
      method: "GET",
      url: `/api/studios/${zumba.json().id}`,
      headers,
    });
    expect(fetched.json()).toEqual(zumba.json());

    const list = await app.inject({ method: "GET", url: "/api/studios", headers });
    const names = list.json().map((studio: { name: string }) => studio.name);
    expect(names).toEqual([...names].sort());
  });

  it("answers 400 for invalid input, 404 for unknown ids and 409 for a duplicate name", async () => {
    expect((await createStudio("Pool", 0)).statusCode).toBe(400);

    await createStudio("Spinning");
    expect((await createStudio("SPINNING")).statusCode).toBe(409);

    const unknown = await app.inject({
      method: "GET",
      url: "/api/studios/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2222",
      headers: await auth.bearer(["admin"]),
    });
    expect(unknown.statusCode).toBe(404);
  });

  it("updates with optimistic versioning", async () => {
    const created = (await createStudio("Pilates", 12)).json();
    const headers = await auth.bearer(["admin"]);

    const updated = await app.inject({
      method: "PATCH",
      url: `/api/studios/${created.id}`,
      headers,
      payload: { version: 1, capacity: 14 },
    });
    expect(updated.json()).toMatchObject({ capacity: 14, version: 2 });

    const stale = await app.inject({
      method: "PATCH",
      url: `/api/studios/${created.id}`,
      headers,
      payload: { version: 1, capacity: 16 },
    });
    expect(stale.statusCode).toBe(409);
  });

  it("archives a studio, hides it from the default list and frees its name", async () => {
    const created = (await createStudio("Sauna", 8)).json();
    const headers = await auth.bearer(["admin"]);

    const archived = await app.inject({
      method: "POST",
      url: `/api/studios/${created.id}/archive`,
      headers,
    });
    expect(archived.json()).toMatchObject({ archived: true });

    const list = await app.inject({ method: "GET", url: "/api/studios", headers });
    expect(list.json().map((studio: { id: string }) => studio.id)).not.toContain(created.id);

    expect((await createStudio("Sauna", 8)).statusCode).toBe(201);
  });
});
