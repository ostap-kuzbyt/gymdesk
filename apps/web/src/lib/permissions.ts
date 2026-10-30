import type { Role } from "@gymdesk/shared";

export function isAdmin(roles: readonly Role[]): boolean {
  return roles.includes("admin");
}

export function isFrontDesk(roles: readonly Role[]): boolean {
  return roles.includes("admin") || roles.includes("reception");
}

export function isCoachOnly(roles: readonly Role[]): boolean {
  return roles.includes("coach") && !isFrontDesk(roles);
}

export const canCheckIn = isFrontDesk;
