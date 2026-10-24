import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../testing/test-db.js";
import type { TestDb } from "../testing/test-db.js";
import { createPgBossQueue } from "./queue.js";
import type { Queue } from "./queue.js";

let testDb: TestDb;
let queue: Queue;
const errors: unknown[] = [];

beforeAll(async () => {
  testDb = await createTestDb();
  queue = createPgBossQueue(testDb.url, { error: (error) => errors.push(error) });
  await queue.start();
});

afterAll(async () => {
  await queue.stop();
  await testDb.dispose();
});

describe("pg-boss queue", () => {
  it("runs a registered worker for an enqueued job", async () => {
    const ran = new Promise<void>((resolve) => {
      void queue.work("test.echo", async () => resolve());
    });

    await queue.enqueue("test.echo");

    await expect(ran).resolves.toBeUndefined();
  }, 20_000);

  it("stores a cron schedule with the club's time zone and keeps it unique per queue", async () => {
    await queue.schedule("test.daily", "0 8 * * *", "Europe/Kyiv");
    await queue.schedule("test.daily", "30 9 * * *", "Europe/Kyiv");

    const rows = await testDb.db.execute<{ cron: string; timezone: string }>(
      sql`select cron, timezone from pgboss.schedule where name = 'test.daily'`,
    );

    expect(rows.rows).toEqual([{ cron: "30 9 * * *", timezone: "Europe/Kyiv" }]);
    expect(errors).toEqual([]);
  });
});
