import type { Role } from "@gymdesk/shared";

export type NavGroup = "main" | "club";

export interface NavItem {
  id: string;
  label: string;
  to: string;
  group: NavGroup;
  roles: readonly Role[];
}

const EVERYONE: readonly Role[] = ["admin", "reception", "coach"];
const FRONT_DESK: readonly Role[] = ["admin", "reception"];

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "today", label: "Today", to: "/", group: "main", roles: EVERYONE },
  { id: "members", label: "Members", to: "/members", group: "main", roles: EVERYONE },
  { id: "schedule", label: "Schedule", to: "/schedule", group: "main", roles: EVERYONE },
  { id: "reminders", label: "Reminders", to: "/reminders", group: "main", roles: FRONT_DESK },
  { id: "reports", label: "Reports", to: "/reports", group: "main", roles: FRONT_DESK },
  { id: "tariffs", label: "Tariffs", to: "/tariffs", group: "club", roles: EVERYONE },
  { id: "studios", label: "Studios", to: "/studios", group: "club", roles: EVERYONE },
  { id: "coaches", label: "Coaches", to: "/coaches", group: "club", roles: EVERYONE },
];

export function navFor(roles: readonly Role[], group?: NavGroup): NavItem[] {
  return NAV_ITEMS.filter(
    (item) =>
      (group === undefined || item.group === group) &&
      item.roles.some((allowed) => roles.includes(allowed)),
  );
}

export function canOpen(roles: readonly Role[], pathname: string): boolean {
  const section = `/${pathname.split("/")[1] ?? ""}`;
  const item = NAV_ITEMS.find((candidate) => candidate.to === section);
  if (!item) return roles.length > 0;
  return item.roles.some((allowed) => roles.includes(allowed));
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  reception: "Reception",
  coach: "Coach",
};
