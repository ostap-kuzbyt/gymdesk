import { id, isCalendarDate } from "@gymdesk/shared";
import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { AppLayout } from "@/layout/app-layout";
import { NotFound } from "@/pages/not-found";
import { CoachPage } from "@/pages/coach-page";
import { CoachesPage } from "@/pages/coaches-page";
import { MemberPage } from "@/pages/member-page";
import { MembersPage } from "@/pages/members-page";
import { mondayOf } from "@/lib/week";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { SchedulePage } from "@/pages/schedule-page";
import { WorkoutPage } from "@/pages/workout-page";
import { StudiosPage } from "@/pages/studios-page";
import { TariffsPage } from "@/pages/tariffs-page";

const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFound });

const page = (path: string, title: string) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => <PlaceholderPage title={title} />,
  });

const memberRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "members/$memberId",
  component: MemberPage,
});

const routeTree = rootRoute.addChildren([
  page("/", "Today"),
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
  page("reminders", "Reminders"),
  page("reports", "Reports"),
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
