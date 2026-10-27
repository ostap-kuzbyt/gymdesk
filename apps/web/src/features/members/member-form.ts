import { isCalendarDate } from "@gymdesk/shared";
import type { MemberView, NewMemberInput } from "@gymdesk/shared";
import { z } from "zod";
import { todayLocal } from "@/lib/format";

export const memberFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the member's full name")
    .max(120, "Keep the name under 120 characters"),
  birthDate: z
    .string()
    .refine((value) => isCalendarDate(value), "Enter the date of birth")
    .refine((value) => value <= todayLocal(), "The date of birth cannot be in the future"),
  email: z.string().trim().pipe(z.email("Enter a valid email address")),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\+[1-9]\d{7,14}$/.test(value),
      "Use the international format, for example +380501234567",
    ),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export function toNewMember(values: MemberFormValues): NewMemberInput {
  return {
    fullName: values.fullName.trim(),
    birthDate: values.birthDate,
    email: values.email.trim(),
    ...(values.phone === "" ? {} : { phone: values.phone }),
  };
}

export function formValuesOf(member: MemberView): MemberFormValues {
  return {
    fullName: member.fullName,
    birthDate: member.birthDate,
    email: member.email,
    phone: member.phone ?? "",
  };
}

export const emptyMemberForm: MemberFormValues = {
  fullName: "",
  birthDate: "",
  email: "",
  phone: "",
};

export function toMemberChanges(values: MemberFormValues) {
  return {
    fullName: values.fullName.trim(),
    birthDate: values.birthDate,
    email: values.email.trim(),
    phone: values.phone === "" ? null : values.phone,
  };
}
