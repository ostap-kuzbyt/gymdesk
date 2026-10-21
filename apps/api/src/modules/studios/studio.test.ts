import { describe, expect, it } from "vitest";
import { DomainError } from "../../platform/errors.js";
import { Studio } from "./studio.js";

describe("Studio", () => {
  it("starts active at version 1 with a trimmed name", () => {
    const studio = Studio.create({ name: "  Main hall ", capacity: 25 });

    expect(studio.toSnapshot()).toMatchObject({
      name: "Main hall",
      capacity: 25,
      archived: false,
      version: 1,
    });
  });

  it.each([
    ["a name that is too short", { name: "x", capacity: 10 }],
    ["a zero capacity", { name: "Yoga room", capacity: 0 }],
    ["a fractional capacity", { name: "Yoga room", capacity: 2.5 }],
    ["a capacity above 500", { name: "Yoga room", capacity: 501 }],
  ])("rejects %s", (_label, input) => {
    expect(() => Studio.create(input)).toThrow(DomainError);
  });

  it("applies partial changes and keeps the previous state when one is invalid", () => {
    const studio = Studio.create({ name: "Cycling", capacity: 20 });

    studio.change({ capacity: 24 });
    expect(studio.toSnapshot()).toMatchObject({ name: "Cycling", capacity: 24 });

    expect(() => studio.change({ capacity: 0 })).toThrow(DomainError);
    expect(studio.toSnapshot().capacity).toBe(24);
  });

  it("refuses changes and a second archive once archived", () => {
    const studio = Studio.create({ name: "Boxing", capacity: 12 });

    studio.archive();

    expect(studio.archived).toBe(true);
    expect(() => studio.archive()).toThrow(DomainError);
    expect(() => studio.change({ name: "Kickboxing" })).toThrow(DomainError);
  });
});
