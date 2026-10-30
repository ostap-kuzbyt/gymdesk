import { Link } from "@tanstack/react-router";
import { useSession } from "@/auth/session";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { EmptyState, ErrorNotice, TableSkeleton } from "@/components/query-states";
import { StatBlock } from "@/components/stat-block";
import { Button } from "@/components/ui/button";
import { useCoaches } from "@/features/coaches/api";
import { useExpiringMembers } from "@/features/members/api";
import { ActiveUntil } from "@/features/members/subscription-plate";
import { useReminders } from "@/features/reminders/api";
import { useAttendance, useRevenue } from "@/features/reports/api";
import { useStudios } from "@/features/studios/api";
import { useWorkouts } from "@/features/workouts/api";
import { fillOf } from "@/features/workouts/capacity";
import { useCurrency } from "@/lib/config-context";
import { formatDate, formatMoney, todayLocal } from "@/lib/format";
import { WEEKDAY_LONG, weekdayOf } from "@/lib/hours";
import { isAdmin, isFrontDesk } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const EXPIRY_WINDOW_DAYS = 7;
const FILL_DOT = {
  green: "bg-plate-green",
  yellow: "bg-plate-yellow",
  red: "bg-plate-red",
  blue: "bg-plate-blue",
  neutral: "bg-muted-foreground",
} as const;

export function TodayPage() {
  const { roles } = useSession();
  const frontDesk = isFrontDesk(roles);
  const admin = isAdmin(roles);
  const currency = useCurrency();
  const today = todayLocal();

  const arrivals = useAttendance({ from: today, to: today, limit: 100, offset: 0 }, frontDesk);
  const failed = useReminders({ status: "failed", offset: 0, limit: 1 }, frontDesk);
  const monthStart = `${today.slice(0, 7)}-01`;
  const sales = useRevenue({ from: monthStart, to: today, granularity: "month", enabled: admin });

  const todaysWorkouts = useWorkouts({ from: today, to: today });
  const endingSoon = useExpiringMembers(EXPIRY_WINDOW_DAYS);
  const arrived = arrivals.data?.items.filter((item) => item.visits > 0).length;
  const failedCount = failed.data?.total ?? 0;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Today"
        description={`${WEEKDAY_LONG[weekdayOf(today) - 1]}, ${formatDate(today)}`}
        actions={
          frontDesk ? (
            <Button asChild>
              <Link to="/check-in">Open check-in</Link>
            </Button>
          ) : undefined
        }
      />

      {frontDesk && failedCount > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-plate-red bg-plate-red-soft px-4 py-3"
        >
          <span className="font-medium">
            {failedCount === 1
              ? "1 reminder could not be delivered."
              : `${failedCount} reminders could not be delivered.`}
          </span>
          <Link
            to="/reminders"
            search={{ status: "failed", kind: undefined, page: undefined }}
            className="font-medium text-primary hover:underline"
          >
            Review and retry
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))]">
        {frontDesk ? (
          <StatBlock
            tone="green"
            value={arrived === undefined ? "–" : String(arrived)}
            label={arrived === 1 ? "Member arrived today" : "Members arrived today"}
          />
        ) : null}
        <StatBlock
          value={todaysWorkouts.data ? String(todaysWorkouts.data.length) : "–"}
          label={todaysWorkouts.data?.length === 1 ? "Workout scheduled" : "Workouts scheduled"}
        />
        <StatBlock
          tone="yellow"
          value={endingSoon.data ? String(endingSoon.data.total) : "–"}
          label={endingSoon.data?.total === 1 ? "Subscription ends soon" : "Subscriptions end soon"}
          note={`Within the next ${EXPIRY_WINDOW_DAYS} days`}
        />
        {admin && sales.data ? (
          <StatBlock
            tone="blue"
            compact
            value={formatMoney(sales.data.totalCents, currency)}
            label="Sold this month"
            note={`from ${sales.data.totalSubscriptions} ${
              sales.data.totalSubscriptions === 1 ? "subscription" : "subscriptions"
            }`}
          />
        ) : null}
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TodaysWorkouts today={today} />
        <EndingSoon />
      </div>
    </section>
  );
}

function TodaysWorkouts({ today }: { today: string }) {
  const workouts = useWorkouts({ from: today, to: today });
  const studios = useStudios(true);
  const coaches = useCoaches(true);
  const studioName = (id: string) =>
    studios.data?.find((studio) => studio.id === id)?.name ?? "Studio";
  const coachName = (id: string) =>
    coaches.data?.find((coach) => coach.id === id)?.fullName ?? "Coach";

  return (
    <Panel
      title="Workouts today"
      action={
        <Link
          to="/schedule"
          search={{ week: undefined, studio: undefined, coach: undefined }}
          className="text-sm font-medium text-primary hover:underline"
        >
          Full schedule
        </Link>
      }
    >
      {workouts.isPending ? <TableSkeleton columns={2} rows={3} /> : null}
      {workouts.isError ? (
        <ErrorNotice error={workouts.error} onRetry={() => void workouts.refetch()} />
      ) : null}
      {workouts.data && workouts.data.length === 0 ? (
        <p className="text-muted-foreground">No workouts are scheduled today.</p>
      ) : null}
      {workouts.data && workouts.data.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {[...workouts.data]
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((workout) => {
              const fill = fillOf(workout.reserved, workout.capacity);
              return (
                <li key={workout.id}>
                  <Link
                    to="/workouts/$workoutId"
                    params={{ workoutId: workout.id }}
                    className="-mx-4 flex items-center gap-4 px-4 py-3 hover:bg-accent focus-visible:outline-2"
                  >
                    <span className="w-28 shrink-0 font-stamp text-lg tabular-nums">
                      {workout.startTime}–{workout.endTime}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{workout.title}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {studioName(workout.studioId)} · {coachName(workout.coachId)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className={cn("size-2.5 rounded-full", FILL_DOT[fill.tone])}
                      />
                      {workout.reserved} of {workout.capacity}
                    </span>
                  </Link>
                </li>
              );
            })}
        </ul>
      ) : null}
    </Panel>
  );
}

function EndingSoon() {
  const { roles } = useSession();
  const expiring = useExpiringMembers(EXPIRY_WINDOW_DAYS);
  const items = [...(expiring.data?.items ?? [])].sort((a, b) =>
    (a.activeUntil ?? "").localeCompare(b.activeUntil ?? ""),
  );

  return (
    <Panel
      title="Ending this week"
      action={
        isFrontDesk(roles) ? (
          <Link
            to="/reminders"
            search={{ status: undefined, kind: undefined, page: undefined }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Reminders
          </Link>
        ) : null
      }
    >
      {expiring.isPending ? <TableSkeleton columns={2} rows={3} /> : null}
      {expiring.isError ? (
        <ErrorNotice error={expiring.error} onRetry={() => void expiring.refetch()} />
      ) : null}
      {expiring.data && items.length === 0 ? (
        <EmptyState
          title="Nothing ends this week"
          hint="Subscriptions that end in the next 7 days will be listed here."
        />
      ) : null}
      {items.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <Link
                  to="/members/$memberId"
                  params={{ memberId: member.id }}
                  className="block truncate font-medium hover:text-primary hover:underline"
                >
                  {member.fullName}
                </Link>
                <div className="text-sm">
                  <ActiveUntil activeUntil={member.activeUntil} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
