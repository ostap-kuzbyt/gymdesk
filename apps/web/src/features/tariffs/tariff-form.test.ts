import { describe, expect, it } from "vitest";
import { formValuesOf, parsePriceToCents, tariffFormSchema, toTariffInput } from "./tariff-form";

const valid = { name: "Monthly", price: "49.90", durationDays: "30", visitLimit: "" };

describe("parsePriceToCents", () => {
  it("converts decimal text to whole cents without float errors", () => {
    expect(parsePriceToCents("49")).toBe(4900);
    expect(parsePriceToCents("49.9")).toBe(4990);
    expect(parsePriceToCents("49,90")).toBe(4990);
    expect(parsePriceToCents("0.07")).toBe(7);
    expect(parsePriceToCents("19.99")).toBe(1999);
    expect(parsePriceToCents("0")).toBe(0);
  });
});

describe("tariffFormSchema", () => {
  it("accepts a complete tariff with or without a visit limit", () => {
    expect(tariffFormSchema.safeParse(valid).success).toBe(true);
    expect(tariffFormSchema.safeParse({ ...valid, visitLimit: "12" }).success).toBe(true);
  });

  it.each([
    ["a name that is too short", { name: "x" }],
    ["a price with letters", { price: "ten" }],
    ["a price with three decimals", { price: "4.999" }],
    ["a negative price", { price: "-5" }],
    ["a fractional duration", { durationDays: "2.5" }],
    ["a duration of zero", { durationDays: "0" }],
    ["a duration beyond two years", { durationDays: "733" }],
    ["a visit limit of zero", { visitLimit: "0" }],
    ["a visit limit with letters", { visitLimit: "many" }],
  ])("rejects %s", (_label, override) => {
    expect(tariffFormSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});

describe("toTariffInput", () => {
  it("builds the api payload, turning an empty limit into unlimited", () => {
    expect(toTariffInput({ ...valid, name: "  Monthly " })).toEqual({
      name: "Monthly",
      priceCents: 4990,
      durationDays: 30,
      visitLimit: null,
    });
    expect(toTariffInput({ ...valid, visitLimit: "12" }).visitLimit).toBe(12);
  });
});

describe("formValuesOf", () => {
  it("shows a tariff in the form's text fields", () => {
    expect(
      formValuesOf({
        id: "t1",
        name: "Ten visits",
        priceCents: 3500,
        durationDays: 60,
        visitLimit: 10,
        archived: false,
        version: 3,
      }),
    ).toEqual({ name: "Ten visits", price: "35.00", durationDays: "60", visitLimit: "10" });
  });
});
