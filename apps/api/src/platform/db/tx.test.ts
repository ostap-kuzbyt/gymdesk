import { describe, expect, it } from "vitest";
import { isConflictViolation } from "./tx.js";

describe("isConflictViolation", () => {
  it("recognises a postgres unique violation", () => {
    expect(isConflictViolation(Object.assign(new Error("dup"), { code: "23505" }))).toBe(true);
  });

  it("recognises an exclusion constraint violation", () => {
    expect(isConflictViolation(Object.assign(new Error("overlap"), { code: "23P01" }))).toBe(true);
  });

  it("finds the code on a wrapped cause", () => {
    const wrapped = new Error("query failed", {
      cause: Object.assign(new Error("dup"), { code: "23505" }),
    });

    expect(isConflictViolation(wrapped)).toBe(true);
  });

  it("ignores other database errors and non-errors", () => {
    expect(isConflictViolation(Object.assign(new Error("fk"), { code: "23503" }))).toBe(false);
    expect(isConflictViolation("23505")).toBe(false);
    expect(isConflictViolation(null)).toBe(false);
  });
});
