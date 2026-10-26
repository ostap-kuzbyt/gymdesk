import { describe, expect, it } from "vitest";
import { canCheckIn } from "./permissions";

describe("canCheckIn", () => {
  it("allows the admin and the front desk but not coaches", () => {
    expect(canCheckIn(["admin"])).toBe(true);
    expect(canCheckIn(["reception"])).toBe(true);
    expect(canCheckIn(["coach", "reception"])).toBe(true);
    expect(canCheckIn(["coach"])).toBe(false);
    expect(canCheckIn([])).toBe(false);
  });
});
