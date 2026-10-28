import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemberSearch } from "@/features/members/api";
import { ActiveUntil } from "@/features/members/subscription-plate";
import { useAttendance } from "@/features/reports/api";
import { useCheckIn } from "@/features/use-check-in";
import { formatTime, todayLocal } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface Eligible {
  id: string;
  fullName: string;
}

export function CheckInDeskPage() {
  const today = todayLocal();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [arrivedAt, setArrivedAt] = useState<Record<string, string>>({});
  const term = useDebouncedValue(text.trim(), 200);
  const searching = term.length >= 2;
  const results = useMemberSearch({ q: term, offset: 0, limit: 6 });
  const arrivals = useAttendance({ from: today, to: today, limit: 100, offset: 0 });
  const { checkIn, isPending } = useCheckIn();

  useEffect(() => {
    input.current?.focus();
  }, []);

  const found = searching ? (results.data?.items ?? []) : [];
  const firstEligible = found.find((member) => member.activeUntil !== null);

  function admit(member: Eligible) {
    checkIn(
      { id: member.id, name: member.fullName },
      {
        onSuccess: (visit) => {
          setArrivedAt((current) => ({ ...current, [member.id]: formatTime(visit.checkedInAt) }));
          setText("");
          input.current?.focus();
        },
      },
    );
  }

  const arrived = arrivals.data?.items.filter((item) => item.visits > 0) ?? [];

  return (
    <section>
      <PageHeader title="Check-in" description="Find who is at the door and check them in." />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (firstEligible && !isPending) admit(firstEligible);
            }}
          >
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                ref={input}
                type="search"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Name, email or phone"
                aria-label="Find a member"
                autoComplete="off"
                className="h-12 pl-10 text-lg"
              />
            </div>
          </form>

          <div className="mt-4" aria-live="polite">
            {!searching ? (
              <p className="py-6 text-muted-foreground">
                Type at least two letters of a name, email or phone number.
              </p>
            ) : results.isPending ? (
              <TableSkeleton columns={2} rows={3} />
            ) : results.isError ? (
              <ErrorNotice error={results.error} onRetry={() => void results.refetch()} />
            ) : found.length === 0 ? (
              <EmptyState
                title="Nobody found"
                hint={`No member matches "${term}". Check the spelling, or register them first.`}
                action={
                  <Link
                    to="/members"
                    search={{ q: undefined, page: undefined }}
                    className="font-medium text-primary hover:underline"
                  >
                    Go to members
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {found.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        to="/members/$memberId"
                        params={{ memberId: member.id }}
                        className="block truncate text-lg font-medium hover:text-primary hover:underline"
                      >
                        {member.fullName}
                      </Link>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                      <div className="mt-1 text-sm">
                        <ActiveUntil activeUntil={member.activeUntil} />
                      </div>
                    </div>
                    {member.activeUntil !== null ? (
                      <Button
                        size="lg"
                        disabled={isPending}
                        onClick={() => admit(member)}
                        aria-label={`Check in ${member.fullName}`}
                      >
                        Check in
                      </Button>
                    ) : (
                      <Link
                        to="/members/$memberId"
                        params={{ memberId: member.id }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Open profile to sell one
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {firstEligible ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Press Enter to check in {firstEligible.fullName}.
              </p>
            ) : null}
          </div>
        </div>

        <aside aria-label="Arrived today">
          <h2 className="mb-3">Arrived today</h2>
          {arrivals.isPending ? <TableSkeleton columns={1} rows={4} /> : null}
          {arrivals.isError ? (
            <ErrorNotice error={arrivals.error} onRetry={() => void arrivals.refetch()} />
          ) : null}
          {arrivals.data && arrived.length === 0 ? (
            <p className="text-muted-foreground">Nobody has checked in yet today.</p>
          ) : null}
          {arrived.length > 0 ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                {arrived.length === 1 ? "1 member" : `${arrived.length} members`}
              </p>
              <ul className="flex flex-col divide-y divide-border">
                {arrived.map((item) => (
                  <li
                    key={item.memberId}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <Link
                      to="/members/$memberId"
                      params={{ memberId: item.memberId }}
                      className="truncate hover:text-primary hover:underline"
                    >
                      {item.fullName}
                    </Link>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {arrivedAt[item.memberId] ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
