import type { Role } from "@gymdesk/shared";

export function canCheckIn(roles: readonly Role[]): boolean {
  return roles.includes("admin") || roles.includes("reception");
}
