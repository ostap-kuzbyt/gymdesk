import { describe, expect, it } from "vitest";
import { canOpen, navFor } from "./nav";

const labels = (roles: Parameters<typeof navFor>[0], group?: Parameters<typeof navFor>[1]) =>
  navFor(roles, group).map((item) => item.label);

describe("navFor", () => {
  it("shows everything to an admin", () => {
    expect(labels(["admin"])).toEqual([
      "Today",
      "Check-in",
      "Members",
      "Schedule",
      "Reminders",
      "Reports",
      "Tariffs",
      "Studios",
      "Coaches",
    ]);
  });

  it("shows the front desk the same pages as an admin", () => {
    expect(labels(["reception"])).toEqual(labels(["admin"]));
  });

  it("hides check-in, reminders and reports from coaches", () => {
    expect(labels(["coach"])).toEqual([
      "Today",
      "Members",
      "Schedule",
      "Tariffs",
      "Studios",
      "Coaches",
    ]);
  });

  it("splits the pages into the main tabs and the club menu", () => {
    expect(labels(["admin"], "main")).toEqual([
      "Today",
      "Check-in",
      "Members",
      "Schedule",
      "Reminders",
      "Reports",
    ]);
    expect(labels(["admin"], "club")).toEqual(["Tariffs", "Studios", "Coaches"]);
  });

  it("combines the pages of several roles and shows nothing without a role", () => {
    expect(labels(["coach", "reception"])).toHaveLength(9);
    expect(labels([])).toEqual([]);
  });
});

describe("canOpen", () => {
  it("allows a section that the role can see, including its nested pages", () => {
    expect(canOpen(["coach"], "/members")).toBe(true);
    expect(canOpen(["coach"], "/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1111")).toBe(true);
    expect(canOpen(["reception"], "/reports")).toBe(true);
    expect(canOpen(["admin"], "/")).toBe(true);
  });

  it("refuses a section the role cannot see", () => {
    expect(canOpen(["coach"], "/reports")).toBe(false);
    expect(canOpen(["coach"], "/reminders")).toBe(false);
    expect(canOpen(["coach"], "/check-in")).toBe(false);
    expect(canOpen(["reception"], "/check-in")).toBe(true);
  });

  it("refuses everything without a role and lets unknown pages through for staff", () => {
    expect(canOpen([], "/")).toBe(false);
    expect(canOpen(["coach"], "/nothing-here")).toBe(true);
  });
});
