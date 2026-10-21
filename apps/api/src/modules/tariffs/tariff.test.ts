import { describe, expect, it } from "vitest";
import { DomainError } from "../../platform/errors.js";
import { Tariff } from "./tariff.js";

const monthly = { name: "Monthly", priceCents: 4900, durationDays: 30 };

describe("Tariff.create", () => {
  it("starts active at version 1 and defaults to unlimited visits", () => {
    const tariff = Tariff.create(monthly);

    expect(tariff.toSnapshot()).toMatchObject({
      name: "Monthly",
      priceCents: 4900,
      durationDays: 30,
      visitLimit: null,
      archived: false,
      version: 1,
    });
  });

  it("trims the name", () => {
    expect(Tariff.create({ ...monthly, name: "  Yearly  " }).toSnapshot().name).toBe("Yearly");
  });

  it.each([
    ["a name that is too short", { name: "x" }],
    ["a fractional price", { priceCents: 10.5 }],
    ["a negative price", { priceCents: -1 }],
    ["a zero duration", { durationDays: 0 }],
    ["a duration beyond two years", { durationDays: 733 }],
    ["a zero visit limit", { visitLimit: 0 }],
  ])("rejects %s", (_label, override) => {
    expect(() => Tariff.create({ ...monthly, ...override })).toThrow(DomainError);
  });

  it("accepts a free tariff and a single-visit tariff", () => {
    expect(() =>
      Tariff.create({ name: "Trial", priceCents: 0, durationDays: 1, visitLimit: 1 }),
    ).not.toThrow();
  });
});

describe("Tariff.change", () => {
  it("applies valid changes and keeps the rest", () => {
    const tariff = Tariff.create({ ...monthly, visitLimit: 12 });

    tariff.change({ priceCents: 5500 });

    expect(tariff.toSnapshot()).toMatchObject({ priceCents: 5500, visitLimit: 12 });
  });

  it("can lift a visit limit by setting it to null", () => {
    const tariff = Tariff.create({ ...monthly, visitLimit: 12 });

    tariff.change({ visitLimit: null });

    expect(tariff.toSnapshot().visitLimit).toBeNull();
  });

  it("leaves the tariff untouched when a change is invalid", () => {
    const tariff = Tariff.create(monthly);

    expect(() => tariff.change({ priceCents: -5 })).toThrow(DomainError);
    expect(tariff.toSnapshot().priceCents).toBe(4900);
  });
});

describe("Tariff.archive", () => {
  it("archives once and then refuses further changes", () => {
    const tariff = Tariff.create(monthly);

    tariff.archive();

    expect(tariff.archived).toBe(true);
    expect(() => tariff.archive()).toThrow(DomainError);
    expect(() => tariff.change({ priceCents: 1 })).toThrow(DomainError);
  });
});

describe("Tariff.endDateFor", () => {
  it("counts the start day as the first day of the term", () => {
    expect(Tariff.create(monthly).endDateFor("2026-01-01")).toBe("2026-01-30");
    expect(Tariff.create({ ...monthly, durationDays: 1 }).endDateFor("2026-03-10")).toBe(
      "2026-03-10",
    );
  });

  it("rolls over month and year boundaries", () => {
    expect(Tariff.create({ ...monthly, durationDays: 365 }).endDateFor("2026-03-01")).toBe(
      "2027-02-28",
    );
  });

  it("rejects dates that do not exist", () => {
    expect(() => Tariff.create(monthly).endDateFor("2026-02-30")).toThrow(DomainError);
    expect(() => Tariff.create(monthly).endDateFor("soon")).toThrow(DomainError);
  });
});
