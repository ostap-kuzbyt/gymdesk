import { describe, expect, it } from "vitest";
import { DomainError } from "../../platform/errors.js";
import { Reminder } from "./reminder.js";

const createdAt = "2026-10-21T08:00:00.000Z";
const expiryInput = {
  memberId: "member-1",
  subscriptionId: "sub-1",
  email: " Olena@Example.COM ",
  trigger: "scan" as const,
};

describe("Reminder.expiry", () => {
  it("starts pending with a normalised address and no attempts", () => {
    expect(Reminder.expiry(expiryInput, createdAt, "r1").toSnapshot()).toEqual({
      id: "r1",
      memberId: "member-1",
      subscriptionId: "sub-1",
      kind: "expiry",
      trigger: "scan",
      email: "olena@example.com",
      status: "pending",
      attempts: 0,
      error: null,
      createdAt,
      sentAt: null,
    });
  });

  it.each(["", "not-an-email", "a@b"])("rejects the address %j", (email) => {
    expect(() => Reminder.expiry({ ...expiryInput, email }, createdAt)).toThrow(DomainError);
  });
});

describe("Reminder.promo", () => {
  it("is a manual reminder that is not tied to a subscription", () => {
    const reminder = Reminder.promo({ memberId: "member-1", email: "a@example.com" }, createdAt);

    expect(reminder.toSnapshot()).toMatchObject({
      kind: "promo",
      trigger: "manual",
      subscriptionId: null,
    });
  });
});

describe("delivery outcome", () => {
  it("records a successful delivery", () => {
    const reminder = Reminder.expiry(expiryInput, createdAt);

    reminder.markSent("2026-10-21T08:00:05.000Z");

    expect(reminder.toSnapshot()).toMatchObject({
      status: "sent",
      attempts: 1,
      sentAt: "2026-10-21T08:00:05.000Z",
      error: null,
    });
  });

  it("records a failure with a truncated reason and allows a retry that succeeds", () => {
    const reminder = Reminder.expiry(expiryInput, createdAt);

    reminder.markFailed("x".repeat(900));
    expect(reminder.toSnapshot()).toMatchObject({ status: "failed", attempts: 1 });
    expect(reminder.toSnapshot().error).toHaveLength(500);

    reminder.retry();
    expect(reminder.status).toBe("pending");

    reminder.markSent("2026-10-22T08:00:00.000Z");
    expect(reminder.toSnapshot()).toMatchObject({ status: "sent", attempts: 2, error: null });
  });

  it("refuses transitions that make no sense", () => {
    const reminder = Reminder.expiry(expiryInput, createdAt);

    expect(() => reminder.retry()).toThrow(DomainError);

    reminder.markSent(createdAt);
    expect(() => reminder.markSent(createdAt)).toThrow(DomainError);
    expect(() => reminder.markFailed("late")).toThrow(DomainError);
    expect(() => reminder.retry()).toThrow(DomainError);
  });
});

describe("Reminder.restore", () => {
  it("does not share state with the snapshot it came from", () => {
    const snapshot = Reminder.expiry(expiryInput, createdAt).toSnapshot();

    Reminder.restore(snapshot).markSent(createdAt);

    expect(snapshot.status).toBe("pending");
  });
});
