import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMemberSearch } from "@/features/members/api";
import { RegisterMemberDialog } from "@/features/members/register-member-dialog";
import { ActiveUntil } from "@/features/members/subscription-plate";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { isFrontDesk } from "@/lib/permissions";

const PAGE_SIZE = 25;
const membersRoute = getRouteApi("/members");

export function MembersPage() {
  const { roles } = useSession();
  const canRegister = isFrontDesk(roles);
  const search = membersRoute.useSearch();
  const navigate = useNavigate();

  const [text, setText] = useState(search.q ?? "");
  const term = useDebouncedValue(text.trim(), 250);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (term === (search.q ?? "")) return;
    void navigate({
      to: "/members",
      search: { q: term || undefined, page: undefined },
      replace: true,
    });
  }, [term, search.q, navigate]);

  const page = search.page ?? 1;
  const members = useMemberSearch({
    q: search.q ?? "",
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
  });
  const total = members.data?.total ?? 0;
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  const registerButton = canRegister ? (
    <Button onClick={() => setRegistering(true)}>Register member</Button>
  ) : undefined;

  return (
    <section>
      <PageHeader
        title="Members"
        description="Everyone who trains at the club."
        actions={registerButton}
      />

      <div className="relative mb-4 max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Search by name, email or phone"
          aria-label="Search members"
          className="pl-8"
        />
      </div>

      {members.isPending ? <TableSkeleton columns={4} /> : null}
      {members.isError ? (
        <ErrorNotice error={members.error} onRetry={() => void members.refetch()} />
      ) : null}
      {members.data && members.data.items.length === 0 ? (
        search.q ? (
          <EmptyState
            title="No members found"
            hint={`Nobody matches "${search.q}". Check the spelling or try an email or phone number.`}
          />
        ) : (
          <EmptyState
            title="No members yet"
            hint={
              canRegister
                ? "Register the first member to start selling subscriptions."
                : "Members will appear here once the front desk registers them."
            }
            action={registerButton}
          />
        )
      ) : null}
      {members.data && members.data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="text-right">Age</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead>Subscription</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.data.items.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link
                      to="/members/$memberId"
                      params={{ memberId: member.id }}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {member.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{member.email}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{member.age}</TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {member.phone ?? "–"}
                  </TableCell>
                  <TableCell>
                    <ActiveUntil activeUntil={member.activeUntil} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <nav
            aria-label="Pages of members"
            className="mt-4 flex items-center justify-between text-sm"
          >
            <p className="text-muted-foreground" aria-live="polite">
              {first}–{last} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() =>
                  void navigate({
                    to: "/members",
                    search: { q: search.q, page: page - 1 === 1 ? undefined : page - 1 },
                  })
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={last >= total}
                onClick={() =>
                  void navigate({
                    to: "/members",
                    search: { q: search.q, page: page + 1 },
                  })
                }
              >
                Next
              </Button>
            </div>
          </nav>
        </>
      ) : null}

      <RegisterMemberDialog open={registering} onOpenChange={setRegistering} />
    </section>
  );
}
