import { randomUUID } from "node:crypto";
import { DomainError } from "../../platform/errors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReminderKind = "expiry" | "promo";
export type ReminderStatus = "pending" | "sent" | "failed";
export type ReminderTrigger = "scan" | "manual";

export interface ReminderSnapshot {
  id: string;
  memberId: string;
  subscriptionId: string | null;
  kind: ReminderKind;
  trigger: ReminderTrigger;
  email: string;
  status: ReminderStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface ExpiryReminderInput {
  memberId: string;
  subscriptionId: string;
  email: string;
  trigger: ReminderTrigger;
}

export interface PromoReminderInput {
  memberId: string;
  email: string;
}

const MAX_ERROR_LENGTH = 500;

function normaliseEmail(email: string): string {
  const normalised = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalised)) {
    throw new DomainError("The member has no valid email address to send to");
  }
  return normalised;
}

export class Reminder {
  private constructor(private snapshot: ReminderSnapshot) {}

  static expiry(
    input: ExpiryReminderInput,
    createdAt: string,
    id: string = randomUUID(),
  ): Reminder {
    return new Reminder({
      id,
      memberId: input.memberId,
      subscriptionId: input.subscriptionId,
      kind: "expiry",
      trigger: input.trigger,
      email: normaliseEmail(input.email),
      status: "pending",
      attempts: 0,
      error: null,
      createdAt,
      sentAt: null,
    });
  }

  static promo(input: PromoReminderInput, createdAt: string, id: string = randomUUID()): Reminder {
    return new Reminder({
      id,
      memberId: input.memberId,
      subscriptionId: null,
      kind: "promo",
      trigger: "manual",
      email: normaliseEmail(input.email),
      status: "pending",
      attempts: 0,
      error: null,
      createdAt,
      sentAt: null,
    });
  }

  static restore(snapshot: ReminderSnapshot): Reminder {
    return new Reminder({ ...snapshot });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get status(): ReminderStatus {
    return this.snapshot.status;
  }

  toSnapshot(): ReminderSnapshot {
    return { ...this.snapshot };
  }

  markSent(at: string): void {
    this.assertStatus("pending", "Only a pending reminder can be marked as sent");
    this.snapshot = {
      ...this.snapshot,
      status: "sent",
      attempts: this.snapshot.attempts + 1,
      error: null,
      sentAt: at,
    };
  }

  markFailed(reason: string): void {
    this.assertStatus("pending", "Only a pending reminder can be marked as failed");
    this.snapshot = {
      ...this.snapshot,
      status: "failed",
      attempts: this.snapshot.attempts + 1,
      error: reason.slice(0, MAX_ERROR_LENGTH),
    };
  }

  retry(): void {
    this.assertStatus("failed", "Only a failed reminder can be retried");
    this.snapshot = { ...this.snapshot, status: "pending" };
  }

  private assertStatus(expected: ReminderStatus, message: string): void {
    if (this.snapshot.status !== expected) throw new DomainError(message);
  }
}
