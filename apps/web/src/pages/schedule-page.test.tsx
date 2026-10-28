import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { todayLocal } from "@/lib/format";
import { mondayOf } from "@/lib/week";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const MAIN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5001";
const YOGA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5002";
const IVAN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6001";
const OLHA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6002";

const studios = [
  { id: MAIN, name: "Main hall", capacity: 30, archived: false, version: 1 },
  { id: YOGA, name: "Yoga room", capacity: 14, archived: false, version: 1 },
];
const coaches = [
  {
    id: IVAN,
    fullName: "Ivan Petrenko",
    specialization: "Strength",
    weeklyHours: [],
    archived: false,
    version: 1,
  },
  {
    id: OLHA,
    fullName: "Olha Koval",
    specialization: "Yoga",
    weeklyHours: [],
    archived: false,
    version: 1,
  },
];

function workout(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b70${String(index).padStart(2, "0")}`,
    title: "Functional training",
    kind: "group",
    studioId: MAIN,
    coachId: IVAN,
    date: "2026-03-04",
    startTime: "18:00",
    endTime: "19:00",
    capacity: 20,
    reserved: 3,
    cancelled: false,
    ...overrides,
  };
}

function scheduleApi(items: object[], overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/workouts": ({ query }) => {
      const from = query.get("from") ?? "";
      const to = query.get("to") ?? "";
      return json(
        (items as { date: string; studioId: string; coachId: string }[]).filter(
          (item) =>
            item.date >= from &&
            item.date <= to &&
            (!query.get("studioId") || item.studioId === query.get("studioId")) &&
            (!query.get("coachId") || item.coachId === query.get("coachId")),
        ),
      );
    },
    "GET /api/studios": () => json(studios),
    "GET /api/coaches": () => json(coaches),
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  const view = renderApp({
    path: "/schedule?week=2026-03-02",
    roles: ["reception"],
    fetch: api,
    ...rest,
  });
  await screen.findByRole("heading", { name: "Schedule" });
  return { user, ...view };
}

const day = (index: number) =>
  screen.getByRole("list", { name: "Days of the week" }).children[index] as HTMLElement;

describe("week view", () => {
  it("asks for the whole week and shows seven days with the dates", async () => {
    const api = scheduleApi([]);
    await openPage({ api });

    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.startsWith("/api/workouts?"))).toBe(true),
    );
    const url = api.urls("GET").find((candidate) => candidate.startsWith("/api/workouts?")) ?? "";
    expect(url).toContain("from=2026-03-02");
    expect(url).toContain("to=2026-03-08");
    expect(screen.getByText("2 Mar 2026 – 8 Mar 2026")).toBeInTheDocument();

    const days = screen.getByRole("list", { name: "Days of the week" }).children;
    expect(days).toHaveLength(7);
    expect(within(days[0] as HTMLElement).getByRole("heading")).toHaveTextContent("Mon2");
    expect(within(days[6] as HTMLElement).getByRole("heading")).toHaveTextContent("Sun8");
  });

  it("puts each workout on its day in time order with studio, coach and places", async () => {
    const api = scheduleApi([
      workout(1, { startTime: "18:00", endTime: "19:00" }),
      workout(2, {
        startTime: "09:00",
        endTime: "10:00",
        title: "Morning yoga",
        studioId: YOGA,
        coachId: OLHA,
        capacity: 14,
        reserved: 13,
      }),
      workout(3, {
        date: "2026-03-06",
        startTime: "12:00",
        endTime: "13:00",
        title: "Spinning",
        reserved: 20,
      }),
    ]);
    await openPage({ api });

    await screen.findByRole("list", { name: "Days of the week" });
    const wednesday = day(2);
    const links = await within(wednesday).findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "09:00–10:00Morning yogaYoga room · Olha Koval13 of 14 · 1 place left",
      "18:00–19:00Functional trainingMain hall · Ivan Petrenko3 of 20 · 17 places left",
    ]);
    expect(within(day(4)).getByRole("link")).toHaveTextContent("20 of 20 · Full");
    expect(within(day(0)).getByText("Nothing scheduled")).toBeInTheDocument();
  });

  it("links each workout to its page", async () => {
    const api = scheduleApi([workout(1)]);
    await openPage({ api });

    await screen.findByRole("list", { name: "Days of the week" });
    const link = await within(day(2)).findByRole("link");
    expect(link).toHaveAttribute("href", "/workouts/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7001");
  });

  it("says when the week is empty", async () => {
    await openPage({ api: scheduleApi([]) });

    expect(await screen.findByText("Nothing is scheduled this week.")).toBeInTheDocument();
  });

  it("explains a loading failure and retries", async () => {
    let failing = true;
    const api = scheduleApi([workout(1)], {
      "GET /api/workouts": () =>
        failing ? problem(503, "The database is restarting") : json([workout(1)]),
    });
    const { user } = await openPage({ api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await within(day(2)).findByRole("link")).toBeInTheDocument();
  });
});

describe("moving between weeks", () => {
  it("goes to the next and previous week and keeps the week in the address", async () => {
    const api = scheduleApi([
      workout(1),
      workout(4, { date: "2026-03-11", title: "Next week class" }),
    ]);
    const { user, router } = await openPage({ api });

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(await screen.findByText("Next week class")).toBeInTheDocument();
    expect(screen.getByText("9 Mar 2026 – 15 Mar 2026")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ week: "2026-03-09" });
    expect(screen.queryByText("Functional training")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(await screen.findByText("Functional training")).toBeInTheDocument();
  });

  it("returns to the current week", async () => {
    const api = scheduleApi([]);
    const { user, router } = await openPage({ api });

    await user.click(screen.getByRole("button", { name: "This week" }));

    await waitFor(() => expect(router.state.location.search).not.toHaveProperty("week"));
    const monday = mondayOf(todayLocal());
    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.includes(`from=${monday}`))).toBe(true),
    );
  });

  it("treats any day in the address as its week", async () => {
    const api = scheduleApi([]);
    renderApp({ path: "/schedule?week=2026-03-06", roles: ["reception"], fetch: api });

    expect(await screen.findByText("2 Mar 2026 – 8 Mar 2026")).toBeInTheDocument();
  });

  it("opens on the current week by default", async () => {
    const api = scheduleApi([]);
    renderApp({ path: "/schedule", roles: ["reception"], fetch: api });
    await screen.findByRole("heading", { name: "Schedule" });

    const monday = mondayOf(todayLocal());
    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.includes(`from=${monday}`))).toBe(true),
    );
  });
});

describe("filters", () => {
  const items = [
    workout(1),
    workout(2, {
      title: "Morning yoga",
      studioId: YOGA,
      coachId: OLHA,
      startTime: "09:00",
      endTime: "10:00",
    }),
  ];

  it("shows only the workouts of the chosen studio and sends the filter to the server", async () => {
    const api = scheduleApi(items);
    const { user, router } = await openPage({ api });
    await screen.findByText("Morning yoga");

    await user.selectOptions(screen.getByRole("combobox", { name: "Studio" }), YOGA);

    await waitFor(() => expect(screen.queryByText("Functional training")).not.toBeInTheDocument());
    expect(screen.getByText("Morning yoga")).toBeInTheDocument();
    expect(api.urls("GET").some((url) => url.includes(`studioId=${YOGA}`))).toBe(true);
    expect(router.state.location.search).toMatchObject({ studio: YOGA, week: "2026-03-02" });
  });

  it("filters by coach and says when nothing matches", async () => {
    const api = scheduleApi([items[0] as object]);
    const { user } = await openPage({ api });
    await screen.findByText("Functional training");

    await user.selectOptions(screen.getByRole("combobox", { name: "Coach" }), OLHA);

    expect(
      await screen.findByText("Nothing is scheduled this week for this filter."),
    ).toBeInTheDocument();
  });

  it("starts with the filter from the address", async () => {
    const api = scheduleApi(items);
    renderApp({
      path: `/schedule?week=2026-03-02&coach=${OLHA}`,
      roles: ["reception"],
      fetch: api,
    });

    expect(await screen.findByText("Morning yoga")).toBeInTheDocument();
    expect(screen.queryByText("Functional training")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Coach" })).toHaveValue(OLHA));
  });
});
