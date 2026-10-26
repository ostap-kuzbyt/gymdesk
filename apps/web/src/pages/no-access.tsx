import { ROLE_LABELS } from "@/nav";
import type { Role } from "@gymdesk/shared";

export function NoAccess({ roles }: { roles: readonly Role[] }) {
  const current = roles.length > 0 ? roles.map((item) => ROLE_LABELS[item]).join(", ") : "no role";

  return (
    <section className="flex max-w-md flex-col gap-2">
      <h1>No access</h1>
      <p className="text-muted-foreground">
        Your account has {current}, which cannot open this page. Ask an admin to change your role if
        you need it.
      </p>
    </section>
  );
}
