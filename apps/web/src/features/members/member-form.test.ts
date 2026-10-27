import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { emptyMemberForm, formValuesOf, memberFormSchema, toNewMember } from "./member-form";

const valid = {
  fullName: "Olena Shevchenko",
  birthDate: "1994-05-17",
  email: "olena@example.com",
  phone: "",
};

describe("memberFormSchema", () => {
  it("accepts a member with and without a phone", () => {
    expect(memberFormSchema.safeParse(valid).success).toBe(true);
    expect(memberFormSchema.safeParse({ ...valid, phone: "+380501234567" }).success).toBe(true);
  });

  it.each([
    ["a name that is too short", { fullName: "O" }],
    ["an empty date of birth", { birthDate: "" }],
    ["a date that does not exist", { birthDate: "1994-02-30" }],
    ["a date of birth in the future", { birthDate: addDays(todayLocal(), 1) }],
    ["an email without a domain", { email: "olena@" }],
    ["a phone without the country code", { phone: "0501234567" }],
    ["a phone with spaces inside", { phone: "+38 050 123 45 67" }],
  ])("rejects %s", (_label, override) => {
    expect(memberFormSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it("explains how to write a phone number", () => {
    const result = memberFormSchema.safeParse({ ...valid, phone: "12345" });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).toContain("international format");
  });
});

describe("toNewMember", () => {
  it("leaves the phone out when it is empty", () => {
    expect(toNewMember({ ...valid, fullName: "  Olena Shevchenko " })).toEqual({
      fullName: "Olena Shevchenko",
      birthDate: "1994-05-17",
      email: "olena@example.com",
    });
    expect(toNewMember({ ...valid, phone: "+380501234567" }).phone).toBe("+380501234567");
  });
});

describe("formValuesOf", () => {
  it("shows a missing phone as an empty field", () => {
    expect(
      formValuesOf({
        id: "m1",
        coachId: null,
        fullName: "Olena Shevchenko",
        birthDate: "1994-05-17",
        email: "olena@example.com",
        phone: null,
        age: 32,
        version: 1,
        subscriptions: [],
      }),
    ).toEqual(valid);
    expect(emptyMemberForm.phone).toBe("");
  });
});
