import { randomUUID } from "node:crypto";
import { isCalendarDate } from "@gymdesk/shared";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import type { CheckIn, VisitUsage } from "./check-in.js";
import { assertValidOffer, overlaps, statusOn } from "./subscription.js";
import type { Subscription, SubscriptionOffer } from "./subscription.js";

const MIN_AGE = 14;
const MAX_AGE = 110;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

export interface MemberProfile {
  fullName: string;
  birthDate: string;
  email: string;
  phone: string | null;
}

export interface MemberSnapshot extends MemberProfile {
  id: string;
  coachId: string | null;
  version: number;
  subscriptions: Subscription[];
}

export interface NewMember {
  fullName: string;
  birthDate: string;
  email: string;
  phone?: string | null | undefined;
}

export interface MemberChanges {
  fullName?: string | undefined;
  birthDate?: string | undefined;
  email?: string | undefined;
  phone?: string | null | undefined;
}

export function ageOn(birthDate: string, date: string): number {
  const years = Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return date.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

function validateProfile(profile: MemberProfile, today: string): MemberProfile {
  const fullName = profile.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 120) {
    throw new DomainError("Full name must be between 2 and 120 characters");
  }

  const email = profile.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new DomainError("Email address is not valid");
  }

  const phone = profile.phone === null ? null : profile.phone.trim();
  if (phone !== null && !PHONE_PATTERN.test(phone)) {
    throw new DomainError("Phone must be in international format, for example +380501234567");
  }

  if (!isCalendarDate(profile.birthDate)) {
    throw new DomainError("Birth date must be a real date as YYYY-MM-DD");
  }
  const age = ageOn(profile.birthDate, today);
  if (age < MIN_AGE || age > MAX_AGE) {
    throw new DomainError(`Members must be between ${MIN_AGE} and ${MAX_AGE} years old`);
  }

  return { fullName, birthDate: profile.birthDate, email, phone };
}

export class Member {
  private constructor(private snapshot: MemberSnapshot) {}

  static register(input: NewMember, today: string, id: string = randomUUID()): Member {
    const profile = validateProfile({ ...input, phone: input.phone ?? null }, today);
    return new Member({ id, ...profile, coachId: null, version: 1, subscriptions: [] });
  }

  static restore(snapshot: MemberSnapshot): Member {
    return new Member({
      ...snapshot,
      subscriptions: snapshot.subscriptions.map((subscription) => ({ ...subscription })),
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get version(): number {
    return this.snapshot.version;
  }

  toSnapshot(): MemberSnapshot {
    return {
      ...this.snapshot,
      subscriptions: this.snapshot.subscriptions.map((subscription) => ({ ...subscription })),
    };
  }

  ageOn(date: string): number {
    return ageOn(this.snapshot.birthDate, date);
  }

  updateProfile(changes: MemberChanges, today: string): void {
    const profile = validateProfile(
      {
        fullName: changes.fullName ?? this.snapshot.fullName,
        birthDate: changes.birthDate ?? this.snapshot.birthDate,
        email: changes.email ?? this.snapshot.email,
        phone: changes.phone === undefined ? this.snapshot.phone : changes.phone,
      },
      today,
    );
    this.snapshot = { ...this.snapshot, ...profile };
  }

  assignCoach(coachId: string | null): void {
    this.snapshot = { ...this.snapshot, coachId };
  }

  purchase(offer: SubscriptionOffer, id: string = randomUUID()): Subscription {
    assertValidOffer(offer);

    const clash = this.snapshot.subscriptions.find(
      (existing) => existing.cancelledOn === null && overlaps(existing, offer),
    );
    if (clash) {
      throw new DomainError(
        `Subscription overlaps with an existing one from ${clash.startsOn} to ${clash.endsOn}`,
      );
    }

    const subscription: Subscription = { id, ...offer, cancelledOn: null };
    this.snapshot.subscriptions.push(subscription);
    return { ...subscription };
  }

  cancelSubscription(subscriptionId: string, on: string): void {
    const subscription = this.snapshot.subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) throw new NotFoundError("Subscription was not found");
    if (subscription.cancelledOn !== null) {
      throw new DomainError("Subscription has already been cancelled");
    }
    if (on > subscription.endsOn) {
      throw new DomainError("Subscription has already ended");
    }
    subscription.cancelledOn = on;
  }

  checkIn(on: string, usage: VisitUsage, id: string = randomUUID()): CheckIn {
    if (!isCalendarDate(on)) {
      throw new DomainError("Visit date must be a real date as YYYY-MM-DD");
    }
    if (usage.alreadyCheckedIn) {
      throw new ConflictError(`Member has already checked in on ${on}`);
    }

    const active = this.snapshot.subscriptions.filter((item) => statusOn(item, on) === "active");
    if (active.length === 0) {
      throw new DomainError(`Member has no active subscription on ${on}`);
    }

    const chosen = active.find(
      (item) =>
        item.visitLimit === null || (usage.visitsBySubscription[item.id] ?? 0) < item.visitLimit,
    );
    if (!chosen) {
      throw new DomainError("The visit limit of the active subscription has been reached");
    }

    return { id, memberId: this.snapshot.id, subscriptionId: chosen.id, visitDate: on };
  }
}
