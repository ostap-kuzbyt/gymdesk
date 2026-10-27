import type { NewTariffInput, TariffView } from "@gymdesk/shared";
import { z } from "zod";

export const tariffFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter a name of at least 2 characters")
    .max(80, "Keep the name under 80 characters"),
  price: z
    .string()
    .trim()
    .regex(/^\d+([.,]\d{1,2})?$/, "Enter a price like 49 or 49.90"),
  durationDays: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number of days")
    .refine((value) => Number(value) >= 1 && Number(value) <= 732, "Use between 1 and 732 days"),
  visitLimit: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (/^\d+$/.test(value) && Number(value) >= 1),
      "Leave empty for unlimited visits, or enter at least 1",
    ),
});

export type TariffFormValues = z.infer<typeof tariffFormSchema>;

export function parsePriceToCents(text: string): number {
  const [whole = "0", fraction = ""] = text.trim().replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function toTariffInput(values: TariffFormValues): NewTariffInput {
  return {
    name: values.name.trim(),
    priceCents: parsePriceToCents(values.price),
    durationDays: Number(values.durationDays),
    visitLimit: values.visitLimit === "" ? null : Number(values.visitLimit),
  };
}

export function formValuesOf(tariff: TariffView): TariffFormValues {
  return {
    name: tariff.name,
    price: (tariff.priceCents / 100).toFixed(2),
    durationDays: String(tariff.durationDays),
    visitLimit: tariff.visitLimit === null ? "" : String(tariff.visitLimit),
  };
}

export const emptyTariffForm: TariffFormValues = {
  name: "",
  price: "",
  durationDays: "30",
  visitLimit: "",
};
