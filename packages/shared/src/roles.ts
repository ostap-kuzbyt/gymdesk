import { z } from "zod";

export const roles = ["admin", "reception", "coach"] as const;

export const role = z.enum(roles);

export type Role = z.infer<typeof role>;
