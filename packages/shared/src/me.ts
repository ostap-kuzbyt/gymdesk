import { z } from "zod";
import { id } from "./primitives.js";
import { role } from "./roles.js";

export const meView = z.object({
  subject: z.string(),
  roles: z.array(role),
  coachId: id.nullable(),
});

export type MeView = z.infer<typeof meView>;
