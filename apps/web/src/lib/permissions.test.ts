import { describe, expect, it } from "vitest";
import { canCheckIn, isAdmin, isFrontDesk } from "./permissions";

describe("permissions", () => {
  it("gives the front desk to the admin and reception but not coaches", () => {
    expect(isFrontDesk(["admin"])).toBe(true);
    expect(isFrontDesk(["reception"])).toBe(true);
    expect(isFrontDesk(["coach", "reception"])).toBe(true);
    expect(isFrontDesk(["coach"])).toBe(false);
    expect(isFrontDesk([])).toBe(false);
  });

  it("lets only the admin manage the catalogue", () => {
    expect(isAdmin(["admin"])).toBe(true);
    expect(isAdmin(["reception", "coach"])).toBe(false);
  });

  it("checks people in at the front desk", () => {
    expect(canCheckIn(["reception"])).toBe(true);
    expect(canCheckIn(["coach"])).toBe(false);
  });
});
