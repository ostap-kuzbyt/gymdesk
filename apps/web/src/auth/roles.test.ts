import { describe, expect, it } from "vitest";
import { parseRoles } from "./roles";

describe("parseRoles", () => {
  it("keeps known roles in order", () => {
    expect(parseRoles(["reception", "admin"])).toEqual(["reception", "admin"]);
  });

  it("drops unknown roles and non-string entries", () => {
    expect(parseRoles(["superuser", 7, null, "coach"])).toEqual(["coach"]);
  });

  it("returns nothing when the claim is missing or not a list", () => {
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles("admin")).toEqual([]);
    expect(parseRoles({ admin: true })).toEqual([]);
  });
});
