import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { AppLayout } from "@/layout/app-layout";
import { NotFound } from "@/pages/not-found";
import { PlaceholderPage } from "@/pages/placeholder-page";
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
  component: () => <PlaceholderPage title="Member" />,
});

const routeTree = rootRoute.addChildren([
  page("/", "Today"),
  page("members", "Members"),
  memberRoute,
  page("schedule", "Schedule"),
  page("reminders", "Reminders"),
  page("reports", "Reports"),
  createRoute({ getParentRoute: () => rootRoute, path: "tariffs", component: TariffsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: "studios", component: StudiosPage }),
  page("coaches", "Coaches"),
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, ...(history ? { history } : {}) });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
