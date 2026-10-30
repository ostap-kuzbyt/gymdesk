import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const today = todayLocal();

function attendanceRow(index: number, overrides: Record<string, unknown> = {}) {
  return {
    memberId: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(1000 + index)}`,
    fullName: `Member ${String(index).padStart(2, "0")}`,
    email: `member${index}@example.com`,
    visits: 10 - (index % 10),
    lastVisitOn: "2026-03-05",
    activeUntil: null,
    ...overrides,
  };
}

const loadRow = (
  date: string,
  id: string,
  name: string,
  minutes: number,
  reserved: number,
  capacity: number,
) => ({
  date,
  id,
  name,
  workouts: 1,
  minutes,
  reserved,
  capacity,
});
const IVAN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6001";
const OLHA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6002";
const MAIN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5001";

function reportsApi(overrides: Parameters<typeof mockApi>[0] = {}, members = 3) {
  const all = Array.from({ length: members }, (_, index) => attendanceRow(index + 1));
  return mockApi({
    "GET /api/reports/attendance": ({ query }) => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 25);
      return json({
        from: query.get("from"),
        to: query.get("to"),
        total: all.length,
        items: all.slice(offset, offset + limit),
      });
    },
    "GET /api/reports/revenue": ({ query }) =>
      json({
        granularity: query.get("granularity") ?? "month",
        rows:
          query.get("granularity") === "year"
            ? [{ period: "2026", revenueCents: 25000, subscriptions: 4 }]
            : [
                { period: "2026-01", revenueCents: 0, subscriptions: 0 },
                { period: "2026-02", revenueCents: 5000, subscriptions: 1 },
                { period: "2026-03", revenueCents: 20000, subscriptions: 3 },
              ],
        totalCents: 25000,
        totalSubscriptions: 4,
      }),
    "GET /api/reports/load": ({ query }) =>
      json({
        from: query.get("from"),
        to: query.get("to"),
        coaches: [
          loadRow("2026-03-04", IVAN, "Ivan Petrenko", 150, 3, 10),
          loadRow("2026-03-05", OLHA, "Olha Koval", 60, 5, 14),
        ],
        studios: [
          loadRow("2026-03-04", MAIN, "Main hall", 150, 3, 10),
          loadRow("2026-03-05", MAIN, "Main hall", 60, 5, 14),
        ],
      }),
    ...overrides,
  });
}

async function openPage(
  path: string,
  api: ReturnType<typeof mockApi>,
  options: RenderOptions = {},
) {
  const user = userEvent.setup();
  const view = renderApp({ path, roles: ["admin"], fetch: api, ...options });
  await screen.findByRole("heading", { name: "Reports" });
  return { user, ...view };
}

const RANGE = "from=2026-03-01&to=2026-03-31";

describe("tabs and ranges", () => {
  it("shows an admin attendance, revenue and workload", async () => {
    await openPage(`/reports?${RANGE}`, reportsApi());

    const tabs = within(screen.getByRole("navigation", { name: "Reports" })).getAllByRole("link");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Attendance", "Revenue", "Workload"]);
    expect(tabs[0]).toHaveAttribute("aria-current", "page");
  });

  it("keeps revenue away from the front desk", async () => {
    await openPage(`/reports?tab=revenue&${RANGE}`, reportsApi(), { roles: ["reception"] });

    const tabs = within(screen.getByRole("navigation", { name: "Reports" })).getAllByRole("link");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Attendance", "Workload"]);
    expect(await screen.findByRole("table")).toHaveTextContent("Member 01");
    expect(screen.queryByText(/Revenue is counted/)).not.toBeInTheDocument();
  });

  it("switches tabs and keeps the page in the address", async () => {
    const { user, router } = await openPage(`/reports?${RANGE}`, reportsApi());

    await user.click(screen.getByRole("link", { name: "Revenue" }));

    expect(await screen.findByText(/from 4 subscriptions/)).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ tab: "revenue" });
  });

  it("opens each tab on its own default range", async () => {
    const api = reportsApi();
    await openPage("/reports", api);

    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.startsWith("/api/reports/attendance"))).toBe(true),
    );
    const url =
      api.urls("GET").find((candidate) => candidate.startsWith("/api/reports/attendance")) ?? "";
    expect(url).toContain(`from=${addDays(today, -29)}`);
    expect(url).toContain(`to=${today}`);
  });

  it("applies a quick range and shows it in the controls", async () => {
    const api = reportsApi();
    const { user, router } = await openPage(`/reports?${RANGE}`, api);
    await screen.findByText("Member 01");

    await user.click(screen.getByRole("button", { name: "This year" }));

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        from: `${today.slice(0, 4)}-01-01`,
        to: today,
      }),
    );
    expect(screen.getByRole("button", { name: "This year" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("From")).toHaveValue(`${today.slice(0, 4)}-01-01`);
  });

  it("changes the start date from the date field", async () => {
    const api = reportsApi();
    await openPage(`/reports?${RANGE}`, api);
    await screen.findByText("Member 01");

    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-03-10" } });

    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.includes("from=2026-03-10"))).toBe(true),
    );
  });

  it("explains a range that ends before it starts and sends nothing", async () => {
    const api = reportsApi();
    await openPage("/reports?from=2026-03-31&to=2026-03-01", api);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The start date must not be after the end date.",
    );
    expect(api.urls("GET").filter((url) => url.startsWith("/api/reports"))).toHaveLength(0);
  });
});

describe("attendance", () => {
  it("lists visits, the last visit and the subscription, with a bar relative to the busiest member", async () => {
    const api = reportsApi({
      "GET /api/reports/attendance": () =>
        json({
          from: "2026-03-01",
          to: "2026-03-31",
          total: 2,
          items: [
            attendanceRow(1, {
              visits: 12,
              lastVisitOn: "2026-03-30",
              activeUntil: addDays(today, 9),
            }),
            attendanceRow(2, { visits: 0, lastVisitOn: null }),
          ],
        }),
    });
    await openPage(`/reports?${RANGE}`, api);

    const busiest = await screen.findByRole("row", { name: /Member 01/ });
    expect(within(busiest).getByText("12")).toBeInTheDocument();
    expect(within(busiest).getByText("30 Mar 2026")).toBeInTheDocument();
    expect(within(busiest).getByRole("img", { name: "9 days left" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Member 02/ })).getByText("Never"),
    ).toBeInTheDocument();
  });

  it("pages through members", async () => {
    const api = reportsApi({}, 30);
    const { user } = await openPage(`/reports?${RANGE}`, api);

    expect(await screen.findByText("1–25 of 30 members")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("26–30 of 30 members")).toBeInTheDocument();
    expect(api.urls("GET").some((url) => url.includes("offset=25"))).toBe(true);
  });

  it("explains a failure and retries", async () => {
    let failing = true;
    const api = reportsApi({
      "GET /api/reports/attendance": () =>
        failing
          ? problem(500, "Reports are unavailable")
          : json({ from: "2026-03-01", to: "2026-03-31", total: 1, items: [attendanceRow(1)] }),
    });
    const { user } = await openPage(`/reports?${RANGE}`, api);

    expect(await screen.findByText("Reports are unavailable")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Member 01")).toBeInTheDocument();
  });
});

describe("revenue", () => {
  it("shows the total, a chart and a table per month", async () => {
    const api = reportsApi();
    await openPage(`/reports?tab=revenue&${RANGE}`, api);

    expect(await screen.findByText(/250\.00/, { selector: "span.font-stamp" })).toBeInTheDocument();
    expect(screen.getByText("from 4 subscriptions")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Revenue by month from 1 Mar 2026 to 31 Mar 2026/ }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.map((row) => row.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Feb 2026"),
        expect.stringContaining("Mar 2026"),
      ]),
    );
    expect(
      screen.getByText(/Revenue is counted in the month a subscription starts/),
    ).toBeInTheDocument();
  });

  it("groups by year on request", async () => {
    const api = reportsApi();
    const { user, router } = await openPage(`/reports?tab=revenue&${RANGE}`, api);
    await screen.findByText("from 4 subscriptions");

    await user.click(screen.getByRole("button", { name: "By year" }));

    expect(await screen.findByRole("img", { name: /Revenue by year/ })).toBeInTheDocument();
    expect(api.urls("GET").some((url) => url.includes("granularity=year"))).toBe(true);
    expect(router.state.location.search).toMatchObject({ granularity: "year" });
    expect(screen.getByRole("button", { name: "By year" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses the singular for one subscription", async () => {
    const api = reportsApi({
      "GET /api/reports/revenue": () =>
        json({
          granularity: "month",
          rows: [{ period: "2026-03", revenueCents: 4900, subscriptions: 1 }],
          totalCents: 4900,
          totalSubscriptions: 1,
        }),
    });
    await openPage(`/reports?tab=revenue&${RANGE}`, api);

    expect(await screen.findByText("from 1 subscription")).toBeInTheDocument();
  });
});

describe("workload", () => {
  it("shows both charts and the totals of each coach and studio", async () => {
    await openPage(`/reports?tab=load&${RANGE}`, reportsApi());

    expect(
      await screen.findByRole("img", { name: /Hours worked per day by each coach/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Places booked against places offered/ }),
    ).toBeInTheDocument();

    const ivan = screen.getByRole("row", { name: /Ivan Petrenko/ });
    expect(within(ivan).getByText("2.5")).toBeInTheDocument();
    expect(within(ivan).getByText("3 of 10 · 30%")).toBeInTheDocument();
    const main = screen.getByRole("row", { name: /Main hall/ });
    expect(within(main).getByText("8 of 24 · 33%")).toBeInTheDocument();
  });

  it("refuses ranges longer than 92 days without asking the server", async () => {
    const api = reportsApi();
    await openPage("/reports?tab=load&from=2026-01-01&to=2026-12-31", api);

    expect(await screen.findByRole("alert")).toHaveTextContent("Workload covers at most 92 days");
    expect(api.urls("GET").some((url) => url.startsWith("/api/reports/load"))).toBe(false);
  });

  it("says when nothing was scheduled", async () => {
    const api = reportsApi({
      "GET /api/reports/load": () =>
        json({ from: "2026-03-01", to: "2026-03-31", coaches: [], studios: [] }),
    });
    await openPage(`/reports?tab=load&${RANGE}`, api);

    expect(
      await screen.findByRole("heading", { name: "No workouts in this period" }),
    ).toBeInTheDocument();
  });
});

describe("access", () => {
  it("is hidden from coaches", async () => {
    renderApp({ path: "/reports", roles: ["coach"], fetch: reportsApi() });

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
  });
});
