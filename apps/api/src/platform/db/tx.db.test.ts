import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConflictError } from "../errors.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";
import { withTx } from "./tx.js";

let testDb: TestDb;

beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.execute(sql`create table tx_probe (name text primary key)`);
});

afterAll(async () => {
  await testDb.dispose();
});

async function names(): Promise<string[]> {
  const result = await testDb.db.execute<{ name: string }>(
    sql`select name from tx_probe order by name`,
  );
  return result.rows.map((row) => row.name);
}

describe("withTx", () => {
  it("commits when the work succeeds", async () => {
    await withTx(testDb.db, (tx) => tx.execute(sql`insert into tx_probe values ('committed')`));

    expect(await names()).toContain("committed");
  });

  it("rolls back when the work throws", async () => {
    await expect(
      withTx(testDb.db, async (tx) => {
        await tx.execute(sql`insert into tx_probe values ('rolled-back')`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await names()).not.toContain("rolled-back");
  });

  it("turns a unique violation into a conflict", async () => {
    await withTx(testDb.db, (tx) => tx.execute(sql`insert into tx_probe values ('unique')`));

    await expect(
      withTx(testDb.db, (tx) => tx.execute(sql`insert into tx_probe values ('unique')`)),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
