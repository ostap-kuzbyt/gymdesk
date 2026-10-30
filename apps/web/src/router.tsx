import { id, isCalendarDate } from "@gymdesk/shared";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { AppLayout } from "@/layout/app-layout";
import { NotFound } from "@/pages/not-found";
import { CheckInDeskPage } from "@/pages/check-in-desk-page";
import { CoachPage } from "@/pages/coach-page";
import { CoachesPage } from "@/pages/coaches-page";
import { MemberPage } from "@/pages/member-page";
import { MembersPage } from "@/pages/members-page";
import { mondayOf } from "@/lib/week";
import { RemindersPage } from "@/pages/reminders-page";
import { ReportsPage } from "@/pages/reports-page";
import { SchedulePage } from "@/pages/schedule-page";
import { WorkoutPage } from "@/pages/workout-page";
import { StudiosPage } from "@/pages/studios-page";
import { TodayPage } from "@/pages/today-page";
import { TariffsPage } from "@/pages/tariffs-page";

const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFound });

const memberRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "members/$memberId",
  component: MemberPage,
});

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: "/", component: TodayPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "check-in", component: CheckInDeskPage }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "members",
    component: MembersPage,
    validateSearch: (
      search: Record<string, unknown>,
    ): { q?: string | undefined; page?: number | undefined } => {
      const page = Number(search.page);
      return {
        q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
        page: Number.isInteger(page) && page > 1 ? page : undefined,
      };
    },
  }),
  memberRoute,
  createRoute({
    getParentRoute: () => rootRoute,
    path: "schedule",
    component: SchedulePage,
    validateSearch: (
      search: Record<string, unknown>,
    ): { week?: string | undefined; studio?: string | undefined; coach?: string | undefined } => {
      const week =
        typeof search.week === "string" && isCalendarDate(search.week)
          ? mondayOf(search.week)
          : undefined;
      const uuid = (value: unknown) =>
        typeof value === "string" && id.safeParse(value).success ? value : undefined;
      return { week, studio: uuid(search.studio), coach: uuid(search.coach) };
    },
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "workouts/$workoutId",
    component: WorkoutPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "reminders",
    component: RemindersPage,
    validateSearch: (
      search: Record<string, unknown>,
    ): {
      status?: "pending" | "sent" | "failed" | undefined;
      kind?: "expiry" | "promo" | undefined;
      page?: number | undefined;
    } => {
      const page = Number(search.page);
      return {
        status:
          search.status === "pending" || search.status === "sent" || search.status === "failed"
            ? search.status
            : undefined,
        kind: search.kind === "expiry" || search.kind === "promo" ? search.kind : undefined,
        page: Number.isInteger(page) && page > 1 ? page : undefined,
      };
    },
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "reports",
    component: ReportsPage,
    validateSearch: (
      search: Record<string, unknown>,
    ): {
      tab?: "attendance" | "revenue" | "load" | undefined;
      from?: string | undefined;
      to?: string | undefined;
      granularity?: "month" | "year" | undefined;
      page?: number | undefined;
    } => {
      const page = Number(search.page);
      const date = (value: unknown) =>
        typeof value === "string" && isCalendarDate(value) ? value : undefined;
      return {
        tab: search.tab === "revenue" || search.tab === "load" ? search.tab : undefined,
        from: date(search.from),
        to: date(search.to),
        granularity: search.granularity === "year" ? "year" : undefined,
        page: Number.isInteger(page) && page > 1 ? page : undefined,
      };
    },
  }),
  createRoute({ getParentRoute: () => rootRoute, path: "tariffs", component: TariffsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "studios", component: StudiosPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "coaches", component: CoachesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "coaches/$coachId", component: CoachPage }),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
