import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createClock } from "../../platform/clock.js";
import type { MailMessage, Mailer } from "../../platform/mailer.js";
import type { Queue } from "../../platform/queue.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";
import { EXPIRY_SCAN_JOB } from "./reminder.job.js";

class FakeQueue implements Queue {
  readonly calls: string[] = [];
  readonly handlers = new Map<string, () => Promise<void>>();
  scheduled: { name: string; cron: string; timeZone: string } | undefined;

  async start() {
    this.calls.push("start");
  }

  async schedule(name: string, cron: string, timeZone: string) {
    this.calls.push("schedule");
    this.scheduled = { name, cron, timeZone };
  }

  async work(name: string, handler: () => Promise<void>) {
    this.calls.push("work");
    this.handlers.set(name, handler);
  }

  async enqueue() {
    this.calls.push("enqueue");
  }

  async stop() {
    this.calls.push("stop");
  }
}

const mailbox: MailMessage[] = [];
const mailer: Mailer = {
  send: async (message) => {
    mailbox.push(message);
  },
};

let testDb: TestDb;
let auth: TestAuth;
let queue: FakeQueue;
let app: FastifyInstance;

beforeEach(async () => {
  mailbox.length = 0;
  queue = new FakeQueue();
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig({ EXPIRY_SCAN_CRON: "15 7 * * *", CLUB_TIMEZONE: "Europe/Kyiv" }), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: createClock("UTC", () => new Date("2026-10-21T09:00:00Z")),
    mailer,
    queue,
  });
});

afterEach(async () => {
  await app.close();
  await testDb.dispose();
});

describe("expiry scan job", () => {
  it("starts the queue, registers the worker and schedules the daily run in the club's time zone", async () => {
    await app.ready();

    expect(queue.calls).toEqual(["start", "work", "schedule"]);
    expect(queue.scheduled).toEqual({
      name: EXPIRY_SCAN_JOB,
      cron: "15 7 * * *",
      timeZone: "Europe/Kyiv",
    });
  });

  it("scans for expiring subscriptions and sends the reminders when the job runs", async () => {
    await app.ready();
    const headers = await auth.bearer(["reception"]);
    const member = (
      await app.inject({
        method: "POST",
        url: "/api/members",
        headers,
        payload: { fullName: "Job Member", birthDate: "1990-01-01", email: "job@example.com" },
      })
    ).json();
    const tariff = await app.inject({
      method: "POST",
      url: "/api/tariffs",
      headers: await auth.bearer(["admin"]),
      payload: { name: "Short", priceCents: 1000, durationDays: 3 },
    });
    await app.inject({
      method: "POST",
      url: `/api/members/${member.id}/subscriptions`,
      headers,
      payload: { tariffId: tariff.json().id },
    });

    await queue.handlers.get(EXPIRY_SCAN_JOB)?.();

    expect(mailbox).toHaveLength(1);
    expect(mailbox[0]).toMatchObject({ to: "job@example.com" });

    await queue.handlers.get(EXPIRY_SCAN_JOB)?.();
    expect(mailbox).toHaveLength(1);
  });

  it("stops the queue when the app closes", async () => {
    await app.ready();
    await app.close();

    expect(queue.calls.at(-1)).toBe("stop");
  });

  it("does not touch a queue when none is configured", async () => {
    const plain = buildApp(testConfig(), { db: testDb.db, verifier: auth.verifier });

    await plain.ready();
    await plain.close();

    const schemas = await testDb.db.execute(
      sql`select 1 from information_schema.schemata where schema_name = 'pgboss'`,
    );
    expect(schemas.rows).toEqual([]);
  });
});
