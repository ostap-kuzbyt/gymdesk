import { z } from "zod";
import { id } from "./primitives.js";

const studioFields = z.object({
  name: z.string().trim().min(2).max(60),
  capacity: z.number().int().min(1).max(500),
});

export const newStudio = studioFields;

export const studioChanges = studioFields.partial().extend({
  version: z.number().int().min(1),
});

export const studioView = studioFields.extend({
  id,
  archived: z.boolean(),
  version: z.number().int().min(1),
});

export type NewStudioInput = z.infer<typeof newStudio>;
export type StudioChangesInput = z.infer<typeof studioChanges>;
export type StudioView = z.infer<typeof studioView>;
