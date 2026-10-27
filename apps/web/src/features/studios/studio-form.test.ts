import { describe, expect, it } from "vitest";
import { formValuesOf, studioFormSchema, toStudioInput } from "./studio-form";

describe("studioFormSchema", () => {
  it("accepts a name and a capacity", () => {
    expect(studioFormSchema.safeParse({ name: "Main hall", capacity: "30" }).success).toBe(true);
  });

  it.each([
    ["a name that is too short", { name: "x", capacity: "10" }],
    ["a capacity of zero", { name: "Yoga room", capacity: "0" }],
    ["a capacity above 500", { name: "Yoga room", capacity: "501" }],
    ["a fractional capacity", { name: "Yoga room", capacity: "2.5" }],
    ["a capacity with letters", { name: "Yoga room", capacity: "many" }],
  ])("rejects %s", (_label, values) => {
    expect(studioFormSchema.safeParse(values).success).toBe(false);
  });
});

describe("conversions", () => {
  it("builds the api payload and the form values", () => {
    expect(toStudioInput({ name: "  Boxing ring ", capacity: "10" })).toEqual({
      name: "Boxing ring",
      capacity: 10,
    });
    expect(
      formValuesOf({ id: "s1", name: "Boxing ring", capacity: 10, archived: false, version: 1 }),
    ).toEqual({ name: "Boxing ring", capacity: "10" });
  });
});
