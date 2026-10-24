import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { createClock } from "../../platform/clock.js";
import type { MailMessage, Mailer } from "../../platform/mailer.js";
import { createTestAuth } from "../../testing/test-auth.js";
import type { TestAuth } from "../../testing/test-auth.js";
import { testConfig } from "../../testing/test-config.js";
import { createTestDb } from "../../testing/test-db.js";
import type { TestDb } from "../../testing/test-db.js";

class RecordingMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failure: Error | undefined;

  async send(message: MailMessage): Promise<void> {
    if (this.failure) throw this.failure;
    this.sent.push(message);
  }
}

const UNKNOWN_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9bdddd";

let testDb: TestDb;
let auth: TestAuth;
let app: FastifyInstance;
let mailer: RecordingMailer;
let instant: Date;
let counter = 0;

type Role = "admin" | "reception" | "coach";

beforeEach(async () => {
  instant = new Date("2026-10-21T09:00:00Z");
  mailer = new RecordingMailer();
  testDb = await createTestDb();
  auth = await createTestAuth();
  app = buildApp(testConfig({ PROMO_DISCOUNT_PERCENT: "15" }), {
    db: testDb.db,
    verifier: auth.verifier,
    clock: createClock("UTC", () => instant),
    mailer,
  });
});

afterEach(async () => {
  await app.close();
  await testDb.dispose();
});

async function call(method: "GET" | "POST", url: string, role: Role, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: await auth.bearer([role]),
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });
}

async function createMember(name = "Olena Shevchenko") {
  counter += 1;
  const response = await call("POST", "/api/members", "reception", {
    fullName: name,
    birthDate: "1990-01-01",
    email: `member${counter}@example.com`,
  });
  return response.json() as { id: string; email: string };
}

async function subscribe(memberId: string, durationDays: number, startsOn?: string) {
  counter += 1;
  const tariff = await call("POST", "/api/tariffs", "admin", {
    name: `Tariff ${counter}`,
    priceCents: 3000,
    durationDays,
  });
  const response = await call("POST", `/api/members/${memberId}/subscriptions`, "reception", {
    tariffId: tariff.json().id,
    ...(startsOn ? { startsOn } : {}),
  });
  return response.json().subscriptions.at(-1) as { id: string };
}

const scan = () => call("POST", "/api/reminders/scan", "admin");

describe("automatic expiry scan", () => {
  it("reminds only members whose active subscription ends within the window", async () => {
    const soon = await createMember("Soon Expiring");
    await subscribe(soon.id, 5);

    const later = await createMember("Later Expiring");
    await subscribe(later.id, 20);

    const renewed = await createMember("Already Renewed");
    await subscribe(renewed.id, 5);
    await subscribe(renewed.id, 30, "2026-10-26");

    const cancelled = await createMember("Cancelled Plan");
    const plan = await subscribe(cancelled.id, 5);
    await call("POST", `/api/members/${cancelled.id}/subscriptions/${plan.id}/cancel`, "reception");

    const upcoming = await createMember("Not Started Yet");
    await subscribe(upcoming.id, 5, "2026-10-23");

    const response = await scan();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      date: "2026-10-21",
      considered: 1,
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({
      to: soon.email,
      subject: "Your Gymdesk subscription ends in 4 days",
    });
    expect(mailer.sent[0]?.html).toContain("25 October 2026");
  });

  it("is idempotent: a second scan on the same day sends nothing", async () => {
    const member = await createMember();
    await subscribe(member.id, 3);

    await scan();
    const second = await scan();

    expect(second.json()).toMatchObject({ considered: 1, sent: 0, skipped: 1 });
    expect(mailer.sent).toHaveLength(1);

    const history = await call("GET", `/api/reminders?memberId=${member.id}`, "admin");
    expect(history.json().total).toBe(1);
  });

  it("records a failed delivery and retries it on the next scan", async () => {
    const member = await createMember();
    await subscribe(member.id, 3);
    mailer.failure = new Error("provider unavailable");

    const first = await scan();
    expect(first.json()).toMatchObject({ considered: 1, sent: 0, failed: 1 });

    const failed = await call("GET", `/api/reminders?status=failed`, "admin");
    expect(failed.json().items[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      error: "provider unavailable",
      memberName: "Olena Shevchenko",
    });

    mailer.failure = undefined;
    instant = new Date("2026-10-22T09:00:00Z");
    const second = await scan();

    expect(second.json()).toMatchObject({ sent: 1, failed: 0 });
    const sent = await call("GET", `/api/reminders?memberId=${member.id}`, "admin");
    expect(sent.json().items).toHaveLength(1);
    expect(sent.json().items[0]).toMatchObject({ status: "sent", attempts: 2, error: null });
  });

  it("reminds again for the next subscription after a renewal", async () => {
    const member = await createMember();
    await subscribe(member.id, 3);
    await scan();

    instant = new Date("2026-10-24T09:00:00Z");
    await subscribe(member.id, 4);
    instant = new Date("2026-10-27T09:00:00Z");
    const result = await scan();

    expect(result.json()).toMatchObject({ sent: 1 });
    expect(mailer.sent).toHaveLength(2);
  });

  it("can only be triggered by admins", async () => {
    expect((await app.inject({ method: "POST", url: "/api/reminders/scan" })).statusCode).toBe(401);
    expect((await call("POST", "/api/reminders/scan", "reception")).statusCode).toBe(403);
    expect((await call("POST", "/api/reminders/scan", "coach")).statusCode).toBe(403);
    expect((await scan()).statusCode).toBe(200);
  });
});

describe("manual reminders", () => {
  it("sends an expiry reminder for an active subscription", async () => {
    const member = await createMember();
    await subscribe(member.id, 10);

    const response = await call("POST", `/api/members/${member.id}/reminders`, "reception", {
      kind: "expiry",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      kind: "expiry",
      trigger: "manual",
      status: "sent",
      email: member.email,
      memberName: "Olena Shevchenko",
    });
    expect(mailer.sent[0]?.subject).toBe("Your Gymdesk subscription ends in 9 days");
  });

  it("does not stop the automatic reminder from going out later", async () => {
    const member = await createMember();
    await subscribe(member.id, 5);
    await call("POST", `/api/members/${member.id}/reminders`, "reception", { kind: "expiry" });

    const result = await scan();

    expect(result.json()).toMatchObject({ sent: 1 });
    expect(mailer.sent).toHaveLength(2);
  });

  it("sends the promotion with the configured discount", async () => {
    const member = await createMember();

    const response = await call("POST", `/api/members/${member.id}/reminders`, "admin", {
      kind: "promo",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ kind: "promo", subscriptionId: null, status: "sent" });
    expect(mailer.sent[0]?.subject).toBe("15% off your next Gymdesk subscription");
  });

  it("refuses an expiry reminder without an active subscription", async () => {
    const member = await createMember();
    const none = await call("POST", `/api/members/${member.id}/reminders`, "reception", {
      kind: "expiry",
    });
    expect(none.statusCode).toBe(400);

    await subscribe(member.id, 5, "2026-10-30");
    const upcoming = await call("POST", `/api/members/${member.id}/reminders`, "reception", {
      kind: "expiry",
    });
    expect(upcoming.statusCode).toBe(400);
    expect(mailer.sent).toHaveLength(0);
  });

  it("keeps a failed manual reminder visible and lets it be retried", async () => {
    const member = await createMember();
    mailer.failure = new Error("mailbox full");

    const failed = await call("POST", `/api/members/${member.id}/reminders`, "reception", {
      kind: "promo",
    });
    expect(failed.statusCode).toBe(201);
    expect(failed.json()).toMatchObject({ status: "failed", error: "mailbox full" });

    mailer.failure = undefined;
    const retried = await call("POST", `/api/reminders/${failed.json().id}/retry`, "reception");

    expect(retried.statusCode).toBe(200);
    expect(retried.json()).toMatchObject({ status: "sent", attempts: 2, error: null });
    expect(
      (await call("POST", `/api/reminders/${failed.json().id}/retry`, "reception")).statusCode,
    ).toBe(400);
  });

  it("answers 404 for unknown members and reminders and 403 for coaches", async () => {
    const member = await createMember();

    expect(
      (await call("POST", `/api/members/${UNKNOWN_ID}/reminders`, "admin", { kind: "promo" }))
        .statusCode,
    ).toBe(404);
    expect((await call("POST", `/api/reminders/${UNKNOWN_ID}/retry`, "admin")).statusCode).toBe(
      404,
    );
    expect(
      (await call("POST", `/api/members/${member.id}/reminders`, "coach", { kind: "promo" }))
        .statusCode,
    ).toBe(403);
    expect(
      (await call("POST", `/api/members/${member.id}/reminders`, "admin", { kind: "sms" }))
        .statusCode,
    ).toBe(400);
  });
});

describe("reminder history", () => {
  it("lists newest first, filters by status, kind and member, and paginates", async () => {
    const first = await createMember("First Member");
    const second = await createMember("Second Member");
    await call("POST", `/api/members/${first.id}/reminders`, "admin", { kind: "promo" });
    instant = new Date("2026-10-21T10:00:00Z");
    mailer.failure = new Error("down");
    await call("POST", `/api/members/${second.id}/reminders`, "admin", { kind: "promo" });

    const all = await call("GET", "/api/reminders", "reception");
    expect(all.json().total).toBe(2);
    expect(all.json().items.map((item: { memberName: string }) => item.memberName)).toEqual([
      "Second Member",
      "First Member",
    ]);

    const failedOnly = await call("GET", "/api/reminders?status=failed", "reception");
    expect(failedOnly.json().items).toHaveLength(1);

    const byMember = await call("GET", `/api/reminders?memberId=${first.id}`, "reception");
    expect(byMember.json().items[0]).toMatchObject({ memberName: "First Member", status: "sent" });

    const secondPage = await call("GET", "/api/reminders?limit=1&offset=1", "reception");
    expect(secondPage.json()).toMatchObject({ total: 2, items: [{ memberName: "First Member" }] });
  });

  it("is hidden from coaches", async () => {
    expect((await call("GET", "/api/reminders", "coach")).statusCode).toBe(403);
  });
});
