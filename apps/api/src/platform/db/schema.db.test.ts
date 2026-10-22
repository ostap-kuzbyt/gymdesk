import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";
import { ConflictError } from "../errors.js";
import { checkIns, members, subscriptions, tariffs } from "./schema.js";
import { withTx } from "./tx.js";

const TARIFF_ID = "00000000-0000-4000-8000-000000000001";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
  await testDb.db.insert(tariffs).values({
    id: TARIFF_ID,
    name: "Monthly",
    priceCents: 4900,
    durationDays: 30,
  });
});

afterAll(async () => {
  await testDb.dispose();
});

async function addMember(email: string): Promise<string> {
  const id = randomUUID();
  await testDb.db.insert(members).values({
    id,
    fullName: "Test Member",
    birthDate: "1990-01-01",
    email,
  });
  return id;
}

function addSubscription(
  memberId: string,
  startsOn: string,
  endsOn: string,
  cancelledOn: string | null = null,
) {
  const id = randomUUID();
  return withTx(testDb.db, async (tx) => {
    await tx.insert(subscriptions).values({
      id,
      memberId,
      tariffId: TARIFF_ID,
      startsOn,
      endsOn,
      priceCents: 4900,
      cancelledOn,
    });
    return id;
  });
}

describe("subscriptions", () => {
  it("rejects overlapping active subscriptions of one member as a conflict", async () => {
    const memberId = await addMember("overlap@example.com");
    await addSubscription(memberId, "2026-10-01", "2026-10-30");

    await expect(addSubscription(memberId, "2026-10-30", "2026-11-28")).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("allows adjacent ranges, other members, and overlaps with cancelled subscriptions", async () => {
    const memberId = await addMember("adjacent@example.com");
    await addSubscription(memberId, "2026-10-01", "2026-10-30");

    await expect(addSubscription(memberId, "2026-10-31", "2026-11-29")).resolves.toBeTruthy();

    const other = await addMember("other@example.com");
    await expect(addSubscription(other, "2026-10-01", "2026-10-30")).resolves.toBeTruthy();

    const cancelledFirst = await addMember("cancelled@example.com");
    await addSubscription(cancelledFirst, "2026-10-01", "2026-10-30", "2026-10-05");
    await expect(addSubscription(cancelledFirst, "2026-10-10", "2026-11-08")).resolves.toBeTruthy();
  });

  it("rejects a range that ends before it starts", async () => {
    const memberId = await addMember("reversed@example.com");

    await expect(addSubscription(memberId, "2026-10-10", "2026-10-09")).rejects.toThrow();
  });
});

describe("check-ins", () => {
  it("allows one check-in per member per day", async () => {
    const memberId = await addMember("visits@example.com");
    const subscriptionId = await addSubscription(memberId, "2026-10-01", "2026-10-30");
    const visit = (visitDate: string) =>
      withTx(testDb.db, (tx) =>
        tx.insert(checkIns).values({ id: randomUUID(), memberId, subscriptionId, visitDate }),
      );

    await visit("2026-10-21");
    await expect(visit("2026-10-21")).rejects.toBeInstanceOf(ConflictError);
    await expect(visit("2026-10-22")).resolves.toBeDefined();
  });

  it("lets different members check in on the same day", async () => {
    const first = await addMember("first@example.com");
    const second = await addMember("second@example.com");
    const firstSub = await addSubscription(first, "2026-10-01", "2026-10-30");
    const secondSub = await addSubscription(second, "2026-10-01", "2026-10-30");

    await testDb.db.insert(checkIns).values({
      id: randomUUID(),
      memberId: first,
      subscriptionId: firstSub,
      visitDate: "2026-10-21",
    });

    await expect(
      testDb.db.insert(checkIns).values({
        id: randomUUID(),
        memberId: second,
        subscriptionId: secondSub,
        visitDate: "2026-10-21",
      }),
    ).resolves.toBeDefined();
  });

  it("stamps the arrival time", async () => {
    const memberId = await addMember("stamp@example.com");
    const subscriptionId = await addSubscription(memberId, "2026-10-01", "2026-10-30");
    await testDb.db
      .insert(checkIns)
      .values({ id: randomUUID(), memberId, subscriptionId, visitDate: "2026-10-21" });

    const result = await testDb.db.execute<{ stamped: boolean }>(
      sql`select checked_in_at is not null as stamped from check_ins where member_id = ${memberId}`,
    );

    expect(result.rows[0]?.stamped).toBe(true);
  });
});

describe("members", () => {
  it("keeps emails unique", async () => {
    await addMember("unique@example.com");

    await expect(
      withTx(testDb.db, (tx) =>
        tx.insert(members).values({
          id: randomUUID(),
          fullName: "Another Person",
          birthDate: "1991-02-02",
          email: "unique@example.com",
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
