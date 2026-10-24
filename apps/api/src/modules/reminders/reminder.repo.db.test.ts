import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { members, subscriptions, tariffs } from "../../platform/db/schema.js";
import { withTx } from "../../platform/db/tx.js";
import { ConflictError } from "../../platform/errors.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";
import { Reminder } from "./reminder.js";
import { reminderRepo } from "./reminder.repo.js";

let testDb: TestDb;
let tariffId: string;

beforeAll(async () => {
  testDb = await createTestDb();
  tariffId = randomUUID();
  await testDb.db
    .insert(tariffs)
    .values({ id: tariffId, name: "Monthly", priceCents: 4900, durationDays: 30 });
});

afterAll(async () => {
  await testDb.dispose();
});

async function seedMember() {
  const memberId = randomUUID();
  const subscriptionId = randomUUID();
  await testDb.db.insert(members).values({
    id: memberId,
    fullName: "Olena",
    birthDate: "1990-01-01",
    email: `${memberId}@x.io`,
  });
  await testDb.db.insert(subscriptions).values({
    id: subscriptionId,
    memberId,
    tariffId,
    startsOn: "2026-10-01",
    endsOn: "2026-10-30",
    priceCents: 4900,
  });
  return { memberId, subscriptionId };
}

const createdAt = "2026-10-21T08:00:00.000Z";

describe("reminderRepo", () => {
  it("round-trips a reminder and its delivery state", async () => {
    const { memberId, subscriptionId } = await seedMember();
    const reminder = Reminder.expiry(
      { memberId, subscriptionId, email: "olena@example.com", trigger: "scan" },
      createdAt,
    );
    await reminderRepo.insert(testDb.db, reminder);

    reminder.markSent("2026-10-21T08:00:03.000Z");
    await reminderRepo.save(testDb.db, reminder);

    const loaded = await reminderRepo.findById(testDb.db, reminder.id);
    expect(loaded?.toSnapshot()).toEqual(reminder.toSnapshot());
  });

  it("allows only one automatic expiry reminder per subscription", async () => {
    const { memberId, subscriptionId } = await seedMember();
    const first = Reminder.expiry(
      { memberId, subscriptionId, email: "a@example.com", trigger: "scan" },
      createdAt,
    );
    const second = Reminder.expiry(
      { memberId, subscriptionId, email: "a@example.com", trigger: "scan" },
      createdAt,
    );

    await withTx(testDb.db, (tx) => reminderRepo.insert(tx, first));

    await expect(withTx(testDb.db, (tx) => reminderRepo.insert(tx, second))).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect((await reminderRepo.findScanExpiry(testDb.db, subscriptionId))?.id).toBe(first.id);
  });

  it("allows manual reminders next to the automatic one", async () => {
    const { memberId, subscriptionId } = await seedMember();
    const manual = () =>
      Reminder.expiry(
        { memberId, subscriptionId, email: "a@example.com", trigger: "manual" },
        createdAt,
      );

    await reminderRepo.insert(testDb.db, manual());
    await expect(reminderRepo.insert(testDb.db, manual())).resolves.toBeUndefined();
  });

  it("lists newest first with filters, a total and pagination", async () => {
    const { memberId, subscriptionId } = await seedMember();
    const older = Reminder.expiry(
      { memberId, subscriptionId, email: "a@example.com", trigger: "scan" },
      "2026-10-20T08:00:00.000Z",
    );
    const newer = Reminder.promo({ memberId, email: "a@example.com" }, "2026-10-21T08:00:00.000Z");
    older.markFailed("smtp down");
    await reminderRepo.insert(testDb.db, older);
    await reminderRepo.insert(testDb.db, newer);
    await reminderRepo.save(testDb.db, older);

    const all = await reminderRepo.list(testDb.db, { memberId, limit: 10, offset: 0 });
    expect(all.reminders.map((reminder) => reminder.id)).toEqual([newer.id, older.id]);
    expect(all.total).toBe(2);

    const failed = await reminderRepo.list(testDb.db, {
      memberId,
      status: "failed",
      limit: 10,
      offset: 0,
    });
    expect(failed.reminders.map((reminder) => reminder.id)).toEqual([older.id]);

    const promos = await reminderRepo.list(testDb.db, {
      memberId,
      kind: "promo",
      limit: 10,
      offset: 0,
    });
    expect(promos.total).toBe(1);

    const secondPage = await reminderRepo.list(testDb.db, { memberId, limit: 1, offset: 1 });
    expect(secondPage.reminders.map((reminder) => reminder.id)).toEqual([older.id]);
    expect(secondPage.total).toBe(2);
  });
});
