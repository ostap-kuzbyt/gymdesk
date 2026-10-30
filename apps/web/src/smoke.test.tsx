import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { ids } from "@/test/fixtures";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render-app";

type Role = "admin" | "reception" | "coach";

interface Page {
  path: string;
  heading: string;
  roles: Role[];
  shows: string;
}

const EVERYONE: Role[] = ["admin", "reception", "coach"];
const FRONT_DESK: Role[] = ["admin", "reception"];

const PAGES: Page[] = [
  { path: "/", heading: "Today", roles: EVERYONE, shows: "Functional training" },
  { path: "/check-in", heading: "Check-in", roles: FRONT_DESK, shows: "Arrived today" },
  { path: "/members", heading: "Members", roles: EVERYONE, shows: "Olena Shevchenko" },
  {
    path: `/members/${ids.memberOlena}`,
    heading: "Olena Shevchenko",
    roles: EVERYONE,
    shows: "Monthly",
  },
  { path: "/schedule", heading: "Schedule", roles: EVERYONE, shows: "Functional training" },
  {
    path: `/workouts/${ids.workoutToday}`,
    heading: "Functional training",
    roles: EVERYONE,
    shows: "Bookings",
  },
  { path: "/reminders", heading: "Reminders", roles: FRONT_DESK, shows: "Mailbox is full" },
  { path: "/reports", heading: "Reports", roles: FRONT_DESK, shows: "Olena Shevchenko" },
  { path: "/tariffs", heading: "Tariffs", roles: EVERYONE, shows: "Ten visits" },
  { path: "/studios", heading: "Studios", roles: EVERYONE, shows: "Yoga room" },
  { path: "/coaches", heading: "Coaches", roles: EVERYONE, shows: "Olha Koval" },
  {
    path: `/coaches/${ids.coachIvan}`,
    heading: "Ivan Petrenko",
    roles: EVERYONE,
    shows: "Working hours",
  },
];

const CASES = PAGES.flatMap((page) =>
  (["admin", "reception", "coach"] as Role[]).map((role) => ({ page, role })),
);

describe("every page for every role", () => {
  it.each(CASES)("$page.path as $role", async ({ page, role }) => {
    renderApp({ path: page.path, roles: [role] });

    if (page.roles.includes(role)) {
      expect(await screen.findByRole("heading", { name: page.heading })).toBeInTheDocument();
      expect((await screen.findAllByText(page.shows)).length).toBeGreaterThan(0);
      expect(screen.queryByRole("heading", { name: "No access" })).not.toBeInTheDocument();
    } else {
      expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: page.heading })).not.toBeInTheDocument();
    }
  });
});

describe("authentication", () => {
  it("sends the session's token with every request", async () => {
    const seen: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      if (new URL(request.url).pathname.startsWith("/api/"))
        seen.push(request.headers.get("authorization"));
    });

    renderApp({ path: "/", roles: ["admin"] });
    await screen.findByText("Functional training");

    expect(seen.length).toBeGreaterThan(3);
    expect(new Set(seen)).toEqual(new Set(["Bearer test-token"]));
    server.events.removeAllListeners();
  });
});

describe("failures", () => {
  it("shows an error with a retry when a list cannot be loaded, then recovers", async () => {
    let failing = true;
    server.use(
      http.get("/api/tariffs", () =>
        failing
          ? HttpResponse.json(
              { title: "Service Unavailable", status: 503, detail: "The database is restarting" },
              { status: 503 },
            )
          : HttpResponse.json([]),
      ),
    );
    const user = userEvent.setup();
    renderApp({ path: "/tariffs", roles: ["admin"] });

    expect(
      await screen.findByText("The database is restarting", {}, { timeout: 5000 }),
    ).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "No tariffs yet" })).toBeInTheDocument();
  });

  it("asks the user to sign in again when the server rejects the token", async () => {
    server.use(
      http.get("/api/members", () =>
        HttpResponse.json(
          { title: "Unauthorized", status: 401, detail: "The token is invalid or has expired" },
          { status: 401 },
        ),
      ),
    );
    const { session } = renderApp({ path: "/members", roles: ["reception"] });

    expect(await screen.findByText("The token is invalid or has expired")).toBeInTheDocument();
    await waitFor(() => expect(session.signIn).toHaveBeenCalled());
  });

  it("shows a not found page for an unknown address", async () => {
    renderApp({ path: "/nothing-here", roles: ["admin"] });

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});

describe("a whole visit to the front desk", () => {
  it("finds a member from the check-in desk and opens their profile", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/check-in", roles: ["reception"] });

    await user.type(await screen.findByRole("searchbox", { name: "Find a member" }), "andriy");
    await user.click(await screen.findByRole("link", { name: "Andriy Bondar" }));

    expect(await screen.findByRole("heading", { name: "Andriy Bondar" })).toBeInTheDocument();
    expect(await screen.findByText("Ten visits")).toBeInTheDocument();
  });

  it("walks from the dashboard to a workout and back to the schedule", async () => {
    const user = userEvent.setup();
    renderApp({ path: "/", roles: ["admin"] });

    await user.click(await screen.findByRole("link", { name: /Functional training/ }));
    expect(await screen.findByRole("heading", { name: "Functional training" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Ivan Petrenko" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("link", { name: "Schedule" })[0] as HTMLElement);
    expect(await screen.findByRole("heading", { name: "Schedule" })).toBeInTheDocument();
  });
});
