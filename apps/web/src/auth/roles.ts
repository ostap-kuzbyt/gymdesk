import { role } from "@gymdesk/shared";
import type { Role } from "@gymdesk/shared";

export function parseRoles(claim: unknown): Role[] {
  if (!Array.isArray(claim)) return [];
  return claim.flatMap((value) => {
    const parsed = role.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}
