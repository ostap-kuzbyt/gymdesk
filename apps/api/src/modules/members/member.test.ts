import { describe, expect, it } from "vitest";
import { ConflictError, DomainError, NotFoundError } from "../../platform/errors.js";
import { Member, ageOn } from "./member.js";
import type { NewMember } from "./member.js";
import { overlaps, statusOn } from "./subscription.js";
import type { SubscriptionOffer } from "./subscription.js";

const TODAY = "2026-10-21";

const profile: NewMember = {
  fullName: "Olena Shevchenko",
  birthDate: "1994-05-17",
  email: "olena@example.com",
};

const monthOffer: SubscriptionOffer = {
  tariffId: "tariff-month",
  startsOn: "2026-10-01",
  endsOn: "2026-10-30",
  priceCents: 4900,
  visitLimit: null,
};

function registered(): Member {
  return Member.register(profile, TODAY, "member-1");
}

const noUsage = { alreadyCheckedIn: false, visitsBySubscription: {} };

describe("Member.register", () => {
  it("normalises the profile and starts without subscriptions", () => {
    const member = Member.register(
      {
        ...profile,
        fullName: "  Olena   Shevchenko ",
        email: " Olena@Example.COM ",
        phone: " +380501234567 ",
      },
      TODAY,
    );

    expect(member.toSnapshot()).toMatchObject({
      fullName: "Olena Shevchenko",
      email: "olena@example.com",
      phone: "+380501234567",
      version: 1,
      subscriptions: [],
    });
  });

  it("treats the phone as optional", () => {
    expect(registered().toSnapshot().phone).toBeNull();
  });

  it.each([
    ["a one-letter name", { fullName: "O" }],
    ["an email without a domain", { email: "olena@" }],
    ["a phone without the country code", { phone: "0501234567" }],
    ["a birth date that does not exist", { birthDate: "1994-02-30" }],
    ["a member younger than 14", { birthDate: "2013-01-01" }],
    ["a birth date in the future", { birthDate: "2030-01-01" }],
    ["an implausible age", { birthDate: "1900-01-01" }],
  ])("rejects %s", (_label, override) => {
    expect(() => Member.register({ ...profile, ...override }, TODAY)).toThrow(DomainError);
  });

  it("accepts a member who turns 14 today", () => {
    expect(() => Member.register({ ...profile, birthDate: "2012-10-21" }, TODAY)).not.toThrow();
    expect(() => Member.register({ ...profile, birthDate: "2012-10-22" }, TODAY)).toThrow(
      DomainError,
    );
  });
});

describe("ageOn", () => {
  it("counts completed years", () => {
    expect(ageOn("1994-05-17", "2026-05-16")).toBe(31);
    expect(ageOn("1994-05-17", "2026-05-17")).toBe(32);
  });
});

describe("Member.updateProfile", () => {
  it("changes only the given fields and can clear the phone", () => {
    const member = Member.register({ ...profile, phone: "+380501234567" }, TODAY);

    member.updateProfile({ email: "new@example.com", phone: null }, TODAY);

    expect(member.toSnapshot()).toMatchObject({
      fullName: "Olena Shevchenko",
      email: "new@example.com",
      phone: null,
    });
  });

  it("keeps the old profile when a change is invalid", () => {
    const member = registered();

    expect(() => member.updateProfile({ email: "broken" }, TODAY)).toThrow(DomainError);
    expect(member.toSnapshot().email).toBe("olena@example.com");
  });
});

describe("Member.assignCoach", () => {
  it("starts without a coach and can switch or clear the assignment", () => {
    const member = registered();
    expect(member.toSnapshot().coachId).toBeNull();

    member.assignCoach("coach-1");
    expect(member.toSnapshot().coachId).toBe("coach-1");

    member.assignCoach(null);
    expect(member.toSnapshot().coachId).toBeNull();
  });
});

describe("subscription helpers", () => {
  const subscription = {
    id: "s1",
    tariffId: "t",
    startsOn: "2026-10-10",
    endsOn: "2026-10-20",
    priceCents: 1,
    visitLimit: null,
    cancelledOn: null,
  };

  it("reports the status for a given day", () => {
    expect(statusOn(subscription, "2026-10-09")).toBe("upcoming");
    expect(statusOn(subscription, "2026-10-10")).toBe("active");
    expect(statusOn(subscription, "2026-10-20")).toBe("active");
    expect(statusOn(subscription, "2026-10-21")).toBe("expired");
    expect(statusOn({ ...subscription, cancelledOn: "2026-10-12" }, "2026-10-15")).toBe(
      "cancelled",
    );
  });

  it("treats ranges that share a day as overlapping and adjacent ranges as separate", () => {
    const range = { startsOn: "2026-10-10", endsOn: "2026-10-20" };

    expect(overlaps(range, { startsOn: "2026-10-20", endsOn: "2026-10-25" })).toBe(true);
    expect(overlaps(range, { startsOn: "2026-10-01", endsOn: "2026-10-10" })).toBe(true);
    expect(overlaps(range, { startsOn: "2026-10-12", endsOn: "2026-10-14" })).toBe(true);
    expect(overlaps(range, { startsOn: "2026-10-21", endsOn: "2026-10-30" })).toBe(false);
  });
});

describe("Member.purchase", () => {
  it("adds a subscription with the agreed terms", () => {
    const member = registered();

    const subscription = member.purchase(monthOffer, "sub-1");

    expect(subscription).toEqual({ id: "sub-1", ...monthOffer, cancelledOn: null });
    expect(member.toSnapshot().subscriptions).toHaveLength(1);
  });

  it("refuses a subscription that overlaps an active one", () => {
    const member = registered();
    member.purchase(monthOffer);

    expect(() =>
      member.purchase({ ...monthOffer, startsOn: "2026-10-30", endsOn: "2026-11-28" }),
    ).toThrow(DomainError);
    expect(member.toSnapshot().subscriptions).toHaveLength(1);
  });

  it("allows the next subscription to start the day after the previous one ends", () => {
    const member = registered();
    member.purchase(monthOffer);

    expect(() =>
      member.purchase({ ...monthOffer, startsOn: "2026-10-31", endsOn: "2026-11-29" }),
    ).not.toThrow();
  });

  it("ignores cancelled subscriptions when looking for overlaps", () => {
    const member = registered();
    const first = member.purchase(monthOffer);
    member.cancelSubscription(first.id, "2026-10-05");

    expect(() => member.purchase(monthOffer)).not.toThrow();
  });

  it.each([
    ["an end before the start", { startsOn: "2026-10-10", endsOn: "2026-10-09" }],
    ["an impossible date", { endsOn: "2026-02-30" }],
    ["a negative price", { priceCents: -1 }],
    ["a zero visit limit", { visitLimit: 0 }],
  ])("rejects an offer with %s", (_label, override) => {
    expect(() => registered().purchase({ ...monthOffer, ...override })).toThrow(DomainError);
  });
});

describe("Member.cancelSubscription", () => {
  it("marks the subscription as cancelled", () => {
    const member = registered();
    const subscription = member.purchase(monthOffer);

    member.cancelSubscription(subscription.id, TODAY);

    expect(member.toSnapshot().subscriptions[0]?.cancelledOn).toBe(TODAY);
  });

  it("refuses to cancel twice, after the end date, or an unknown subscription", () => {
    const member = registered();
    const subscription = member.purchase(monthOffer);

    expect(() => member.cancelSubscription(subscription.id, "2026-11-15")).toThrow(DomainError);
    member.cancelSubscription(subscription.id, TODAY);
    expect(() => member.cancelSubscription(subscription.id, TODAY)).toThrow(DomainError);
    expect(() => member.cancelSubscription("missing", TODAY)).toThrow(NotFoundError);
  });
});

describe("Member.checkIn", () => {
  it("records the visit against the active subscription", () => {
    const member = registered();
    const subscription = member.purchase(monthOffer);

    const visit = member.checkIn(TODAY, noUsage, "visit-1");

    expect(visit).toEqual({
      id: "visit-1",
      memberId: "member-1",
      subscriptionId: subscription.id,
      visitDate: TODAY,
    });
  });

  it("refuses a second check-in on the same day with a conflict", () => {
    const member = registered();
    member.purchase(monthOffer);

    expect(() =>
      member.checkIn(TODAY, { alreadyCheckedIn: true, visitsBySubscription: {} }),
    ).toThrow(ConflictError);
  });

  it.each([
    ["before the subscription starts", "2026-09-30"],
    ["after the subscription ended", "2026-10-31"],
  ])("refuses a visit %s", (_label, date) => {
    const member = registered();
    member.purchase(monthOffer);

    expect(() => member.checkIn(date, noUsage)).toThrow(DomainError);
  });

  it("refuses a visit when the only subscription was cancelled", () => {
    const member = registered();
    const subscription = member.purchase(monthOffer);
    member.cancelSubscription(subscription.id, "2026-10-20");

    expect(() => member.checkIn(TODAY, noUsage)).toThrow(DomainError);
  });

  it("refuses a visit once the visit limit is used up", () => {
    const member = registered();
    const subscription = member.purchase({ ...monthOffer, visitLimit: 2 });

    expect(() =>
      member.checkIn(TODAY, {
        alreadyCheckedIn: false,
        visitsBySubscription: { [subscription.id]: 2 },
      }),
    ).toThrow(DomainError);
    expect(() =>
      member.checkIn(TODAY, {
        alreadyCheckedIn: false,
        visitsBySubscription: { [subscription.id]: 1 },
      }),
    ).not.toThrow();
  });

  it("rejects a visit date that does not exist", () => {
    const member = registered();
    member.purchase(monthOffer);

    expect(() => member.checkIn("2026-13-01", noUsage)).toThrow(DomainError);
  });
});
