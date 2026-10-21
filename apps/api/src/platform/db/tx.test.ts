import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./tx.js";

describe("isUniqueViolation", () => {
  it("recognises a postgres unique violation", () => {
    expect(isUniqueViolation(Object.assign(new Error("dup"), { code: "23505" }))).toBe(true);
  });

  it("finds the code on a wrapped cause", () => {
    const wrapped = new Error("query failed", {
      cause: Object.assign(new Error("dup"), { code: "23505" }),
    });

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("ignores other database errors and non-errors", () => {
    expect(isUniqueViolation(Object.assign(new Error("fk"), { code: "23503" }))).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
