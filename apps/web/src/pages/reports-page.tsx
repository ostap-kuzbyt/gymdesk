import { isCalendarDate } from "@gymdesk/shared";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
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
import { ActiveUntil } from "@/features/members/subscription-plate";
import { useAttendance, useLoad, useRevenue } from "@/features/reports/api";
import { CoachHoursChart, RevenueChart, StudioBookingsChart } from "@/features/reports/charts";
import {
  DEFAULT_PRESET,
  fillPercent,
  hoursOf,
  periodLabel,
  pivotBookings,
  pivotHours,
  presetRange,
  totalsOf,
} from "@/features/reports/shape";
import type { DateRange, RangePreset, ReportTab } from "@/features/reports/shape";
import { daysBetween } from "@/lib/dates";
import { useCurrency } from "@/lib/config-context";
import { formatDate, formatMoney, todayLocal } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const reportsRoute = getRouteApi("/reports");
const PAGE_SIZE = 25;
const MAX_LOAD_DAYS = 92;

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "14d", label: "Last 14 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "6m", label: "Last 6 months" },
  { id: "year", label: "This year" },
];

type Search = ReturnType<typeof reportsRoute.useSearch>;

export function ReportsPage() {
  const { roles } = useSession();
  const admin = isAdmin(roles);
  const search = reportsRoute.useSearch();
  const navigate = useNavigate();
  const today = todayLocal();

  const tab: ReportTab =
    search.tab === "revenue" && !admin ? "attendance" : (search.tab ?? "attendance");
  const fallback = presetRange(DEFAULT_PRESET[tab], today);
  const range: DateRange = { from: search.from ?? fallback.from, to: search.to ?? fallback.to };
  const rangeError =
    range.from > range.to ? "The start date must not be after the end date." : undefined;

  function go(next: Partial<Search>) {
    void navigate({
      to: "/reports",
      search: {
        tab: (next.tab ?? tab) === "attendance" ? undefined : (next.tab ?? tab),
        from: next.from,
        to: next.to,
        granularity: next.granularity,
        page: next.page,
      },
    });
  }

  const tabs: { id: ReportTab; label: string }[] = [
    { id: "attendance", label: "Attendance" },
    ...(admin ? [{ id: "revenue" as const, label: "Revenue" }] : []),
    { id: "load", label: "Workload" },
  ];

  return (
    <section>
      <PageHeader
        title="Reports"
        description={`${formatDate(range.from)} – ${formatDate(range.to)}`}
      />

      <nav aria-label="Reports" className="mb-5 flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <Link
            key={item.id}
            to="/reports"
            search={{
              tab: item.id === "attendance" ? undefined : item.id,
              from: undefined,
              to: undefined,
              granularity: undefined,
              page: undefined,
            }}
            aria-current={tab === item.id ? "page" : undefined}
            className={cn(
              "relative px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground",
              tab === item.id &&
                "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6 flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">From</span>
            <Input
              type="date"
              value={range.from}
              onChange={(event) =>
                isCalendarDate(event.target.value) &&
                go({ ...search, from: event.target.value, to: range.to, page: undefined })
              }
              className="h-8 w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">To</span>
            <Input
              type="date"
              value={range.to}
              onChange={(event) =>
                isCalendarDate(event.target.value) &&
                go({ ...search, to: event.target.value, from: range.from, page: undefined })
              }
              className="h-8 w-40"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick ranges">
          {PRESETS.map((preset) => {
            const value = presetRange(preset.id, today);
            const selected = value.from === range.from && value.to === range.to;
            return (
              <Button
                key={preset.id}
                variant={selected ? "secondary" : "outline"}
                size="sm"
                aria-pressed={selected}
                onClick={() => go({ ...search, from: value.from, to: value.to, page: undefined })}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      {rangeError ? (
        <p role="alert" className="text-sm text-destructive">
          {rangeError}
        </p>
      ) : tab === "attendance" ? (
        <AttendancePanel
          range={range}
          page={search.page ?? 1}
          onPage={(page) => go({ ...search, from: range.from, to: range.to, page })}
        />
      ) : tab === "revenue" ? (
        <RevenuePanel
          range={range}
          granularity={search.granularity ?? "month"}
          onGranularity={(granularity) =>
            go({ ...search, tab, from: range.from, to: range.to, granularity })
          }
        />
      ) : (
        <LoadPanel range={range} />
      )}
    </section>
  );
}

function AttendancePanel({
  range,
  page,
  onPage,
}: {
  range: DateRange;
  page: number;
  onPage: (page: number | undefined) => void;
}) {
  const report = useAttendance({ ...range, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  if (report.isPending) return <TableSkeleton columns={4} />;
  if (report.isError)
    return <ErrorNotice error={report.error} onRetry={() => void report.refetch()} />;
  if (report.data.total === 0) {
    return (
      <EmptyState
        title="No members yet"
        hint="Attendance appears here once members are registered."
      />
    );
  }

  const { items, total } = report.data;
  const busiest = Math.max(...items.map((item) => item.visits), 1);
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + items.length - 1;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Visits</TableHead>
            <TableHead className="hidden sm:table-cell">Last visit</TableHead>
            <TableHead className="hidden md:table-cell">Subscription</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.memberId}>
              <TableCell>
                <Link
                  to="/members/$memberId"
                  params={{ memberId: item.memberId }}
                  className="font-medium hover:text-primary hover:underline"
                >
                  {item.fullName}
                </Link>
                <div className="text-xs text-muted-foreground">{item.email}</div>
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-3">
                  <span className="w-8 text-right font-stamp tabular-nums">{item.visits}</span>
                  <span aria-hidden className="h-1.5 w-24 rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-plate-blue"
                      style={{ width: `${(item.visits / busiest) * 100}%` }}
                    />
                  </span>
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {item.lastVisitOn ? (
                  formatDate(item.lastVisitOn)
                ) : (
                  <span className="text-muted-foreground">Never</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <ActiveUntil activeUntil={item.activeUntil} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav
        aria-label="Pages of attendance"
        className="mt-4 flex items-center justify-between text-sm"
      >
        <p className="text-muted-foreground" aria-live="polite">
          {first}–{last} of {total} members
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1 === 1 ? undefined : page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={last >= total}
            onClick={() => onPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </nav>
    </>
  );
}

function RevenuePanel({
  range,
  granularity,
  onGranularity,
}: {
  range: DateRange;
  granularity: "month" | "year";
  onGranularity: (granularity: "month" | "year") => void;
}) {
  const currency = useCurrency();
  const report = useRevenue({ ...range, granularity, enabled: true });

  if (report.isPending) return <TableSkeleton columns={3} />;
  if (report.isError)
    return <ErrorNotice error={report.error} onRetry={() => void report.refetch()} />;

  const { rows, totalCents, totalSubscriptions } = report.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          <span className="font-stamp text-2xl">{formatMoney(totalCents, currency)}</span>{" "}
          <span className="text-muted-foreground">
            from {totalSubscriptions} {totalSubscriptions === 1 ? "subscription" : "subscriptions"}
          </span>
        </p>
        <div role="group" aria-label="Group by" className="flex gap-2">
          {(["month", "year"] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={granularity === option ? "secondary" : "outline"}
              aria-pressed={granularity === option}
              onClick={() => onGranularity(option)}
            >
              {option === "month" ? "By month" : "By year"}
            </Button>
          ))}
        </div>
      </div>

      <RevenueChart
        rows={rows}
        currency={currency}
        label={`Revenue by ${granularity} from ${formatDate(range.from)} to ${formatDate(range.to)}`}
      />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{granularity === "month" ? "Month" : "Year"}</TableHead>
            <TableHead className="text-right">Subscriptions</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.period}>
              <TableCell className="font-medium">{periodLabel(row.period)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.subscriptions}</TableCell>
              <TableCell className="text-right font-stamp tabular-nums">
                {formatMoney(row.revenueCents, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="max-w-xl text-sm text-muted-foreground">
        Revenue is counted in the month a subscription starts. Cancelled subscriptions are left out.
      </p>
    </div>
  );
}

function LoadPanel({ range }: { range: DateRange }) {
  const span = daysBetween(range.from, range.to) + 1;
  if (span > MAX_LOAD_DAYS) {
    return (
      <p role="alert" className="text-sm text-destructive">
        Workload covers at most {MAX_LOAD_DAYS} days. Choose a shorter range.
      </p>
    );
  }
  return <LoadReport range={range} />;
}

function LoadReport({ range }: { range: DateRange }) {
  const report = useLoad(range);

  if (report.isPending) return <TableSkeleton columns={4} />;
  if (report.isError)
    return <ErrorNotice error={report.error} onRetry={() => void report.refetch()} />;
  if (report.data.coaches.length === 0) {
    return (
      <EmptyState
        title="No workouts in this period"
        hint="Pick another range, or schedule workouts first."
      />
    );
  }

  const { coaches, studios } = report.data;
  const hours = pivotHours(coaches, range);
  const bookings = pivotBookings(studios, range);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="mb-3">Coach hours per day</h2>
        <CoachHoursChart
          points={hours.points}
          series={hours.series}
          label={`Hours worked per day by each coach from ${formatDate(range.from)} to ${formatDate(range.to)}`}
        />
        <LoadTable title="Coach" rows={totalsOf(coaches)} />
      </div>
      <div>
        <h2 className="mb-3">Places booked per day</h2>
        <StudioBookingsChart
          points={bookings}
          label={`Places booked against places offered per day from ${formatDate(range.from)} to ${formatDate(range.to)}`}
        />
        <LoadTable title="Studio" rows={totalsOf(studios)} />
      </div>
    </div>
  );
}

function LoadTable({ title, rows }: { title: string; rows: ReturnType<typeof totalsOf> }) {
  return (
    <Table className="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>{title}</TableHead>
          <TableHead className="text-right">Workouts</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead className="text-right">Booked</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.workouts}</TableCell>
            <TableCell className="text-right tabular-nums">{hoursOf(row.minutes)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.reserved} of {row.capacity} · {fillPercent(row.reserved, row.capacity)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
