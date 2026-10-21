import { z } from "zod";
import { id, moneyCents } from "./primitives.js";

const tariffFields = z.object({
  name: z.string().trim().min(2).max(80),
  priceCents: moneyCents,
  durationDays: z.number().int().min(1).max(732),
  visitLimit: z.number().int().min(1).nullable(),
});

export const newTariff = tariffFields.extend({
  visitLimit: tariffFields.shape.visitLimit.default(null),
});

export const tariffChanges = tariffFields.partial().extend({
  version: z.number().int().min(1),
});

export const tariffView = tariffFields.extend({
  id,
  archived: z.boolean(),
  version: z.number().int().min(1),
});

export type NewTariffInput = z.infer<typeof newTariff>;
export type TariffChangesInput = z.infer<typeof tariffChanges>;
export type TariffView = z.infer<typeof tariffView>;
