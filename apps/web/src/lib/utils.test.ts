import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins class names and skips falsy values", () => {
    expect(cn("px-2", false, undefined, "text-sm", null)).toBe("px-2 text-sm");
  });

  it("lets a later tailwind utility win over a conflicting earlier one", () => {
    expect(cn("px-2 py-1", "px-6")).toBe("py-1 px-6");
  });

  it("supports conditional objects and arrays", () => {
    expect(cn(["a", { b: true, c: false }])).toBe("a b");
  });
});
