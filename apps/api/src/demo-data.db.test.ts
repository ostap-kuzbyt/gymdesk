import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearDemoData, seedDemoData } from "./demo-data.js";
import { createTestDb } from "./testing/test-db.js";
import type { TestDb } from "./testing/test-db.js";

const options = { today: "2026-10-21", days: 45, members: 14, seed: 7, timeZone: "Europe/Kyiv" };

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
});

afterAll(async () => {
  await testDb.dispose();
});

describe("seedDemoData", () => {
  it("creates a club with history: subscriptions, visits, workouts, reservations and reminders", async () => {
    const summary = await seedDemoData(testDb.db, options);

    expect(summary).toMatchObject({ tariffs: 5, studios: 4, coaches: 5, members: 14 });
    expect(summary.subscriptions).toBeGreaterThan(14);
    expect(summary.checkIns).toBeGreaterThan(50);
    expect(summary.workouts).toBeGreaterThan(20);
    expect(summary.reservations).toBeGreaterThan(10);
    expect(summary.reminders).toBeGreaterThan(0);
  }, 60_000);

  it("refuses to run twice on the same data", async () => {
    await expect(seedDemoData(testDb.db, options)).rejects.toThrow(/--reset/);
  });

  it("is repeatable: the same seed after a reset produces the same amounts", async () => {
    await clearDemoData(testDb.db);
    const first = await seedDemoData(testDb.db, options);
    await clearDemoData(testDb.db);
    const second = await seedDemoData(testDb.db, options);

    expect(second).toEqual(first);
  }, 120_000);

  it("changes the data when the seed changes", async () => {
    await clearDemoData(testDb.db);
    const other = await seedDemoData(testDb.db, { ...options, seed: 99 });

    expect(other.members).toBe(14);
    expect(other.checkIns).toBeGreaterThan(0);
  }, 60_000);
});
