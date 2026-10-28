import type { WorkoutListItem } from "@gymdesk/shared";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ErrorNotice, TableSkeleton } from "@/components/query-states";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useCoaches } from "@/features/coaches/api";
import { fillOf } from "@/features/workouts/capacity";
import { useStudios } from "@/features/studios/api";
import { useWorkouts } from "@/features/workouts/api";
import { addDays } from "@/lib/dates";
import { formatDate, todayLocal } from "@/lib/format";
import { WEEKDAY_SHORT } from "@/lib/hours";
import { mondayOf, weekDays } from "@/lib/week";
import { cn } from "@/lib/utils";

const scheduleRoute = getRouteApi("/schedule");

const FILL_BAR = {
  green: "bg-plate-green",
  yellow: "bg-plate-yellow",
  red: "bg-plate-red",
  blue: "bg-plate-blue",
  neutral: "bg-muted-foreground",
} as const;

export function SchedulePage() {
  const search = scheduleRoute.useSearch();
  const navigate = useNavigate();
  const today = todayLocal();
  const monday = search.week ?? mondayOf(today);
  const days = weekDays(monday);

  const studios = useStudios(true);
  const coaches = useCoaches(true);
  const workouts = useWorkouts({
    from: monday,
    to: addDays(monday, 6),
    studioId: search.studio,
    coachId: search.coach,
  });

  const studioName = (id: string) =>
    studios.data?.find((studio) => studio.id === id)?.name ?? "Studio";
  const coachName = (id: string) =>
    coaches.data?.find((coach) => coach.id === id)?.fullName ?? "Coach";

  function go(next: {
    week?: string | undefined;
    studio?: string | undefined;
    coach?: string | undefined;
  }) {
    void navigate({
      to: "/schedule",
      search: {
        week: next.week === mondayOf(today) ? undefined : next.week,
        studio: next.studio,
        coach: next.coach,
      },
    });
  }

  const byDay = new Map<string, WorkoutListItem[]>();
  for (const workout of workouts.data ?? []) {
    byDay.set(workout.date, [...(byDay.get(workout.date) ?? []), workout]);
  }

  return (
    <section>
      <PageHeader
        title="Schedule"
        description={`${formatDate(monday)} – ${formatDate(addDays(monday, 6))}`}
        actions={
          <div className="flex items-center gap-2" role="group" aria-label="Week">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous week"
              onClick={() => go({ ...search, week: addDays(monday, -7) })}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => go({ ...search, week: undefined })}>
              This week
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Next week"
              onClick={() => go({ ...search, week: addDays(monday, 7) })}
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <NativeSelect
          size="sm"
          aria-label="Studio"
          value={search.studio ?? ""}
          onChange={(event) =>
            go({ ...search, week: monday, studio: event.target.value || undefined })
          }
        >
          <NativeSelectOption value="">All studios</NativeSelectOption>
          {studios.data
            ?.filter((studio) => !studio.archived)
            .map((studio) => (
              <NativeSelectOption key={studio.id} value={studio.id}>
                {studio.name}
              </NativeSelectOption>
            ))}
        </NativeSelect>
        <NativeSelect
          size="sm"
          aria-label="Coach"
          value={search.coach ?? ""}
          onChange={(event) =>
            go({ ...search, week: monday, coach: event.target.value || undefined })
          }
        >
          <NativeSelectOption value="">All coaches</NativeSelectOption>
          {coaches.data
            ?.filter((coach) => !coach.archived)
            .map((coach) => (
              <NativeSelectOption key={coach.id} value={coach.id}>
                {coach.fullName}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>

      {workouts.isPending ? <TableSkeleton columns={4} rows={4} /> : null}
      {workouts.isError ? (
        <ErrorNotice error={workouts.error} onRetry={() => void workouts.refetch()} />
      ) : null}
      {workouts.data ? (
        <>
          {workouts.data.length === 0 ? (
            <p className="mb-4 text-muted-foreground">
              Nothing is scheduled this week
              {search.studio || search.coach ? " for this filter" : ""}.
            </p>
          ) : null}
          <ol
            className="grid grid-cols-1 gap-x-4 gap-y-6 md:grid-cols-7"
            aria-label="Days of the week"
          >
            {days.map((day, index) => {
              const items = (byDay.get(day) ?? []).sort((a, b) =>
                a.startTime.localeCompare(b.startTime),
              );
              const isToday = day === today;
              return (
                <li key={day} className="min-w-0">
                  <h2
                    className={cn(
                      "mb-2 flex items-baseline gap-1.5 border-b pb-1.5 text-base",
                      isToday ? "border-primary text-primary" : "border-border",
                    )}
                    aria-current={isToday ? "date" : undefined}
                  >
                    <span>{WEEKDAY_SHORT[index]}</span>
                    <span className="tabular-nums">{Number(day.slice(8))}</span>
                  </h2>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing scheduled</p>
                  ) : (
                    <ul className="flex flex-col gap-2.5">
                      {items.map((workout) => {
                        const fill = fillOf(workout.reserved, workout.capacity);
                        return (
                          <li key={workout.id}>
                            <Link
                              to="/workouts/$workoutId"
                              params={{ workoutId: workout.id }}
                              className="relative block rounded-md bg-card py-2 pr-2.5 pl-3.5 text-sm hover:bg-accent focus-visible:outline-2"
                            >
                              <span
                                aria-hidden
                                className={cn(
                                  "absolute inset-y-0 left-0 w-1 rounded-l-md",
                                  FILL_BAR[fill.tone],
                                )}
                              />
                              <span className="font-stamp text-base">
                                {workout.startTime}–{workout.endTime}
                              </span>
                              <span className="block font-medium">{workout.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {studioName(workout.studioId)} · {coachName(workout.coachId)}
                              </span>
                              <span className="mt-1 block text-xs">
                                {workout.reserved} of {workout.capacity} · {fill.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </section>
  );
}
