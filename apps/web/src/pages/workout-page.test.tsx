import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const WORKOUT_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7001";
const STUDIO_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5001";
const COACH_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6001";
const today = todayLocal();
const nextDate = addDays(today, 3);

const reservation = (index: number, memberName: string, cancelled = false) => ({
  id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b80${index}0`,
  memberId: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b81${index}0`,
  memberName,
  reservedAt: `${addDays(today, -1)}T09:15:00.000Z`,
  cancelledAt: cancelled ? `${today}T08:00:00.000Z` : null,
});

interface State {
  id: string;
  title: string;
  kind: string;
  studioId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  reserved: number;
  spotsLeft: number;
  cancelled: boolean;
  version: number;
  reservations: ReturnType<typeof reservation>[];
}

function baseWorkout(overrides: Partial<State> = {}): State {
  const reservations = [
    reservation(1, "Olena Shevchenko"),
    reservation(2, "Andriy Bondar"),
    reservation(3, "Taras Melnyk", true),
  ];
  return {
    id: WORKOUT_ID,
    title: "Hatha yoga",
    kind: "group",
    studioId: STUDIO_ID,
    coachId: COACH_ID,
    date: nextDate,
    startTime: "18:00",
    endTime: "19:00",
    capacity: 3,
    reserved: 2,
    spotsLeft: 1,
    cancelled: false,
    version: 4,
    reservations,
    ...overrides,
  };
}

const KATERYNA = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b9100",
  fullName: "Kateryna Kovalenko",
  age: 28,
  email: "kateryna@example.com",
  phone: null,
  activeUntil: addDays(today, 15),
};

function workoutApi(state: State, overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/workouts/:id": () => json(state),
    "GET /api/studios": () =>
      json([{ id: STUDIO_ID, name: "Yoga room", capacity: 14, archived: false, version: 1 }]),
    "GET /api/coaches": () =>
      json([
        {
          id: COACH_ID,
          fullName: "Olha Koval",
          specialization: "Yoga",
          weeklyHours: [],
          archived: false,
          version: 1,
        },
      ]),
    "GET /api/members": ({ query }) => {
      const q = (query.get("q") ?? "").toLowerCase();
      const all = [
        KATERYNA,
        {
          ...KATERYNA,
          id: state.reservations[0]?.memberId ?? KATERYNA.id,
          fullName: "Olena Shevchenko",
        },
      ];
      const items = all.filter((member) => member.fullName.toLowerCase().includes(q));
      return json({ items, total: items.length });
    },
    "POST /api/workouts/:id/reservations": ({ body }) => {
      const memberId = (body as { memberId: string }).memberId;
      state.reservations.push(reservation(9, "Kateryna Kovalenko"));
      state.reservations[state.reservations.length - 1]!.memberId = memberId;
      state.reserved += 1;
      state.spotsLeft -= 1;
      return json(state, 201);
    },
    "POST /api/workouts/:id/reservations/:reservationId/cancel": ({ params }) => {
      const target = state.reservations.find((item) => item.id === params.reservationId);
      if (target) target.cancelledAt = `${today}T10:00:00.000Z`;
      state.reserved -= 1;
      state.spotsLeft += 1;
      return json(state);
    },
    "POST /api/workouts/:id/cancel": () => {
      state.cancelled = true;
      return json(state);
    },
    ...overrides,
  });
}

async function openPage(
  api: ReturnType<typeof mockApi>,
  state: State,
  options: RenderOptions = {},
) {
  const user = userEvent.setup();
  const view = renderApp({
    path: `/workouts/${state.id}`,
    roles: ["reception"],
    fetch: api,
    ...options,
  });
  await screen.findByRole("heading", { name: state.title });
  return { user, ...view };
}

describe("workout details", () => {
  it("shows when, where, who and how many places are taken", async () => {
    const state = baseWorkout();
    await openPage(workoutApi(state), state);

    expect(screen.getByText("Group workout")).toBeInTheDocument();
    expect(screen.getByText(/18:00–19:00/)).toBeInTheDocument();
    expect(await screen.findByText("Yoga room")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Olha Koval" })).toHaveAttribute(
      "href",
      `/coaches/${COACH_ID}`,
    );
    expect(screen.getByText("2 of 3 · 1 place left")).toBeInTheDocument();
  });

  it("lists active bookings first and shows cancelled ones as such", async () => {
    const state = baseWorkout();
    await openPage(workoutApi(state), state);

    const rows = await screen.findAllByRole("row", { name: /Olena|Andriy|Taras/ });
    expect(rows.map((row) => within(row).getByRole("link").textContent)).toEqual([
      "Olena Shevchenko",
      "Andriy Bondar",
      "Taras Melnyk",
    ]);
    expect(within(rows[0] as HTMLElement).getByText("Booked")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText(/^Cancelled \d/)).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });

  it("labels a personal session", async () => {
    const state = baseWorkout({
      title: "Personal training",
      kind: "individual",
      capacity: 1,
      reserved: 0,
      spotsLeft: 1,
      reservations: [],
    });
    await openPage(workoutApi(state), state);

    expect(screen.getByText("Personal session")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Nobody has booked yet" }),
    ).toBeInTheDocument();
  });

  it("says when the workout does not exist", async () => {
    const api = mockApi({ "GET /api/workouts/:id": () => problem(404, "Workout was not found") });
    renderApp({ path: `/workouts/${WORKOUT_ID}`, roles: ["reception"], fetch: api });

    expect(await screen.findByRole("heading", { name: "Workout not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the schedule" })).toHaveAttribute(
      "href",
      "/schedule",
    );
  });

  it("explains a loading failure and retries", async () => {
    const state = baseWorkout();
    let failing = true;
    const api = workoutApi(state, {
      "GET /api/workouts/:id": () =>
        failing ? problem(503, "The database is restarting") : json(state),
    });
    const user = userEvent.setup();
    renderApp({ path: `/workouts/${WORKOUT_ID}`, roles: ["reception"], fetch: api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Hatha yoga" })).toBeInTheDocument();
  });
});

describe("booking a member", () => {
  it("finds a member and books them", async () => {
    const state = baseWorkout();
    const api = workoutApi(state);
    const { user } = await openPage(api, state);

    await user.type(await screen.findByRole("searchbox", { name: "Find a member" }), "kateryna");
    await user.click(await screen.findByRole("button", { name: "Book Kateryna Kovalenko" }));

    expect(await screen.findByText("Kateryna Kovalenko booked")).toBeInTheDocument();
    expect(api.calls("POST", `/api/workouts/${WORKOUT_ID}/reservations`)[0]?.body).toEqual({
      memberId: KATERYNA.id,
    });
    expect(await screen.findByText("3 of 3 · Full")).toBeInTheDocument();
    expect(await screen.findByText(/This workout is full/)).toBeInTheDocument();
  });

  it("does not offer a member who is already booked", async () => {
    const state = baseWorkout();
    const { user } = await openPage(workoutApi(state), state);

    await user.type(await screen.findByRole("searchbox", { name: "Find a member" }), "olena");

    expect(await screen.findByText("Already booked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book Olena Shevchenko" })).not.toBeInTheDocument();
  });

  it("shows the server's reason when booking is refused", async () => {
    const state = baseWorkout();
    const api = workoutApi(state, {
      "POST /api/workouts/:id/reservations": () =>
        problem(400, "The member has no active subscription on 2026-10-24"),
    });
    const { user } = await openPage(api, state);

    await user.type(await screen.findByRole("searchbox", { name: "Find a member" }), "kateryna");
    await user.click(await screen.findByRole("button", { name: "Book Kateryna Kovalenko" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The member has no active subscription on 2026-10-24",
    );
  });

  it("says when nobody matches the search", async () => {
    const state = baseWorkout();
    const { user } = await openPage(workoutApi(state), state);

    await user.type(await screen.findByRole("searchbox", { name: "Find a member" }), "zzz");

    expect(await screen.findByText('Nobody matches "zzz".')).toBeInTheDocument();
  });

  it("explains when the workout is full, cancelled or already started", async () => {
    const full = baseWorkout({ spotsLeft: 0, reserved: 3, capacity: 3 });
    await openPage(workoutApi(full), full);
    expect(await screen.findByText(/This workout is full/)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Find a member" })).not.toBeInTheDocument();
  });

  it("closes bookings once the workout has started", async () => {
    const state = baseWorkout({ date: today, startTime: "00:00", endTime: "23:59" });
    await openPage(workoutApi(state), state);

    expect(
      await screen.findByText(/This workout has started, so bookings are closed/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel workout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
  });

  it("explains a cancelled workout and hides every action", async () => {
    const state = baseWorkout({ cancelled: true });
    await openPage(workoutApi(state), state);

    expect(screen.getByText("Cancelled", { selector: "[data-slot=badge]" })).toBeInTheDocument();
    expect(await screen.findByText(/This workout was cancelled/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel workout" })).not.toBeInTheDocument();
  });
});

describe("cancelling", () => {
  it("cancels a booking after confirmation and frees the place", async () => {
    const state = baseWorkout();
    const api = workoutApi(state);
    const { user } = await openPage(api, state);

    const row = await screen.findByRole("row", { name: /Olena Shevchenko/ });
    await user.click(within(row).getByRole("button", { name: "Cancel booking" }));
    const confirm = await screen.findByRole("alertdialog", {
      name: "Cancel the booking of Olena Shevchenko?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Cancel booking" }));

    expect(await screen.findByText("Booking of Olena Shevchenko cancelled")).toBeInTheDocument();
    expect(await screen.findByText("1 of 3 · 2 places left")).toBeInTheDocument();
    expect(api.calls("POST", "/api/workouts/").some((call) => call.path.endsWith("/cancel"))).toBe(
      true,
    );
  });

  it("explains why a booking could not be cancelled", async () => {
    const state = baseWorkout();
    const api = workoutApi(state, {
      "POST /api/workouts/:id/reservations/:reservationId/cancel": () =>
        problem(400, "A reservation cannot be cancelled after the workout has started"),
    });
    const { user } = await openPage(api, state);

    const row = await screen.findByRole("row", { name: /Olena Shevchenko/ });
    await user.click(within(row).getByRole("button", { name: "Cancel booking" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Cancel booking" }));

    expect(
      await within(confirm).findByText(/cannot be cancelled after the workout has started/),
    ).toBeInTheDocument();
  });

  it("warns how many members are booked before cancelling the workout", async () => {
    const state = baseWorkout();
    const api = workoutApi(state);
    const { user } = await openPage(api, state);

    await user.click(screen.getByRole("button", { name: "Cancel workout" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Cancel Hatha yoga?" });
    expect(within(confirm).getByText(/2 members are booked/)).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Cancel workout" }));

    expect(await screen.findByText("Workout cancelled")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel workout" })).not.toBeInTheDocument(),
    );
  });
});

describe("coaches", () => {
  it("can see the workout but not change it", async () => {
    const state = baseWorkout();
    await openPage(workoutApi(state), state, { roles: ["coach"] });

    expect(await screen.findByRole("row", { name: /Olena Shevchenko/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel workout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Find a member" })).not.toBeInTheDocument();
  });
});
