import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const today = todayLocal();
const MAIN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5001";
const IVAN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6001";

const workout = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b70${String(index).padStart(2, "0")}`,
  title: "Functional training",
  kind: "group",
  studioId: MAIN,
  coachId: IVAN,
  date: today,
  startTime: "18:00",
  endTime: "19:00",
  capacity: 20,
  reserved: 6,
  cancelled: false,
  ...overrides,
});

const member = (index: number, name: string, daysLeft: number) => ({
  id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(1000 + index)}`,
  fullName: name,
  age: 30,
  email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
  phone: null,
  activeUntil: addDays(today, daysLeft),
});

interface Setup {
  workouts?: object[];
  expiring?: object[];
  arrived?: number;
  failed?: number;
  revenue?: { totalCents: number; totalSubscriptions: number };
}

function todayApi(setup: Setup = {}, overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/workouts": () => json(setup.workouts ?? []),
    "GET /api/studios": () =>
      json([{ id: MAIN, name: "Main hall", capacity: 30, archived: false, version: 1 }]),
    "GET /api/coaches": () =>
      json([
        {
          id: IVAN,
          fullName: "Ivan Petrenko",
          specialization: "Strength",
          weeklyHours: [],
          archived: false,
          version: 1,
        },
      ]),
    "GET /api/members": () =>
      json({ items: setup.expiring ?? [], total: (setup.expiring ?? []).length }),
    "GET /api/reports/attendance": () =>
      json({
        from: today,
        to: today,
        total: 10,
        items: Array.from({ length: 10 }, (_, index) => ({
          memberId: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(3000 + index)}`,
          fullName: `Person ${index}`,
          email: "p@example.com",
          visits: index < (setup.arrived ?? 0) ? 1 : 0,
          lastVisitOn: null,
          activeUntil: null,
        })),
      }),
    "GET /api/reminders": () => json({ items: [], total: setup.failed ?? 0 }),
    "GET /api/reports/revenue": () =>
      json({
        granularity: "month",
        rows: [],
        totalCents: setup.revenue?.totalCents ?? 0,
        totalSubscriptions: setup.revenue?.totalSubscriptions ?? 0,
      }),
    ...overrides,
  });
}

async function openToday(api: ReturnType<typeof mockApi>, options: RenderOptions = {}) {
  const user = userEvent.setup();
  const view = renderApp({ path: "/", roles: ["reception"], fetch: api, ...options });
  await screen.findByRole("heading", { name: "Today" });
  return { user, ...view };
}

describe("workouts today", () => {
  it("lists today's workouts in time order with studio, coach and places", async () => {
    const api = todayApi({
      workouts: [
        workout(1),
        workout(2, {
          title: "Morning yoga",
          startTime: "09:00",
          endTime: "10:00",
          reserved: 14,
          capacity: 14,
        }),
      ],
    });
    await openToday(api);

    const items = await screen.findAllByRole("link", { name: /Morning yoga|Functional training/ });
    expect(items.map((item) => item.textContent)).toEqual([
      "09:00–10:00Morning yogaMain hall · Ivan Petrenko14 of 14",
      "18:00–19:00Functional trainingMain hall · Ivan Petrenko6 of 20",
    ]);
    expect(items[0]).toHaveAttribute("href", "/workouts/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7002");
  });

  it("asks only for today", async () => {
    const api = todayApi();
    await openToday(api);

    await screen.findByText("No workouts are scheduled today.");
    const url = api.urls("GET").find((candidate) => candidate.startsWith("/api/workouts")) ?? "";
    expect(url).toContain(`from=${today}`);
    expect(url).toContain(`to=${today}`);
  });

  it("explains a failure without hiding the rest of the page", async () => {
    const api = todayApi(
      { expiring: [member(1, "Olena Shevchenko", 3)] },
      {
        "GET /api/workouts": () => problem(503, "The database is restarting"),
      },
    );
    await openToday(api);

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    expect(await screen.findByText("Olena Shevchenko")).toBeInTheDocument();
  });
});

describe("ending this week", () => {
  it("lists members whose subscription ends soon, soonest first", async () => {
    const api = todayApi({
      expiring: [member(1, "Later Person", 6), member(2, "Sooner Person", 1)],
    });
    await openToday(api);

    const links = await screen.findAllByRole("link", { name: /Person/ });
    expect(links.map((link) => link.textContent)).toEqual(["Sooner Person", "Later Person"]);
    expect(links[0]).toHaveAttribute("href", "/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1002");
    expect(screen.getByRole("img", { name: "1 day left" })).toBeInTheDocument();
  });

  it("asks the server for subscriptions ending within seven days", async () => {
    const api = todayApi();
    await openToday(api);

    await screen.findByRole("heading", { name: "Nothing ends this week" });
    expect(api.urls("GET").some((url) => url.includes("expiringWithinDays=7"))).toBe(true);
  });
});

describe("front desk summary", () => {
  it("counts arrivals", async () => {
    await openToday(todayApi({ arrived: 4 }));

    expect(await screen.findByText(/members have arrived today/)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("uses the singular for one arrival", async () => {
    await openToday(todayApi({ arrived: 1 }));

    expect(await screen.findByText(/member has arrived today/)).toBeInTheDocument();
  });

  it("warns about undelivered reminders with a link to review them", async () => {
    await openToday(todayApi({ failed: 3 }));

    const message = await screen.findByText("3 reminders could not be delivered.");
    const notice = message.parentElement as HTMLElement;
    expect(within(notice).getByRole("link", { name: "Review and retry" })).toHaveAttribute(
      "href",
      "/reminders?status=failed",
    );
  });

  it("stays quiet when every reminder went out", async () => {
    await openToday(todayApi({ failed: 0, arrived: 2 }));

    await screen.findByText(/members have arrived today/);
    expect(screen.queryByText(/could not be delivered/)).not.toBeInTheDocument();
  });

  it("offers the check-in desk", async () => {
    await openToday(todayApi());

    expect(screen.getByRole("link", { name: "Open check-in" })).toHaveAttribute(
      "href",
      "/check-in",
    );
  });
});

describe("admin", () => {
  it("also sees what was sold this month", async () => {
    const api = todayApi({ revenue: { totalCents: 123456, totalSubscriptions: 12 } });
    await openToday(api, { roles: ["admin"] });

    expect(await screen.findByText(/sold this month from 12 subscriptions/)).toBeInTheDocument();
    expect(screen.getByText(/1,234\.56/)).toBeInTheDocument();
    const url =
      api.urls("GET").find((candidate) => candidate.startsWith("/api/reports/revenue")) ?? "";
    expect(url).toContain(`from=${today.slice(0, 7)}-01`);
  });

  it("does not show sales to reception", async () => {
    const api = todayApi();
    await openToday(api);

    await screen.findByText("No workouts are scheduled today.");
    expect(api.urls("GET").some((url) => url.startsWith("/api/reports/revenue"))).toBe(false);
  });
});

describe("coach", () => {
  it("sees the workouts and expiring members but nothing from the front desk", async () => {
    const api = todayApi({
      workouts: [workout(1)],
      expiring: [member(1, "Olena Shevchenko", 2)],
      failed: 5,
      arrived: 3,
    });
    await openToday(api, { roles: ["coach"] });

    expect(await screen.findByText("Functional training")).toBeInTheDocument();
    expect(await screen.findByText("Olena Shevchenko")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open check-in" })).not.toBeInTheDocument();
    expect(screen.queryByText(/have arrived today/)).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be delivered/)).not.toBeInTheDocument();
    expect(
      api
        .urls("GET")
        .some((url) => url.startsWith("/api/reports") || url.startsWith("/api/reminders")),
    ).toBe(false);
  });
});
