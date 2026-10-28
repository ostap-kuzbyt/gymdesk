import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { mondayOf } from "@/lib/week";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const MAIN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5001";
const YOGA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5002";
const OLD = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b5003";
const IVAN = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6001";
const OLHA = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6002";
const GONE = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b6003";

const today = todayLocal();
const futureDay = addDays(today, 10);

const studios = [
  { id: MAIN, name: "Main hall", capacity: 30, archived: false, version: 1 },
  { id: YOGA, name: "Yoga room", capacity: 14, archived: false, version: 1 },
  { id: OLD, name: "Old sauna", capacity: 4, archived: true, version: 2 },
];
const everyDay = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, from: "08:00", to: "22:00" }));
const coaches = [
  {
    id: IVAN,
    fullName: "Ivan Petrenko",
    specialization: "Strength",
    weeklyHours: everyDay,
    archived: false,
    version: 1,
  },
  {
    id: OLHA,
    fullName: "Olha Koval",
    specialization: "Yoga",
    weeklyHours: [{ weekday: 1, from: "09:00", to: "15:00" }],
    archived: false,
    version: 1,
  },
  {
    id: GONE,
    fullName: "Retired Coach",
    specialization: "Boxing",
    weeklyHours: [],
    archived: true,
    version: 3,
  },
];

function created(body: Record<string, unknown>) {
  return {
    id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7777",
    title: body.title,
    kind: body.kind,
    studioId: body.studioId,
    coachId: body.coachId,
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    capacity: body.kind === "individual" ? 1 : (body.capacity ?? 30),
    reserved: 0,
    spotsLeft: body.kind === "individual" ? 1 : (body.capacity ?? 30),
    cancelled: false,
    version: 1,
    reservations: [],
  };
}

function scheduleApi(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/workouts": () => json([]),
    "GET /api/studios": ({ query }) =>
      json(studios.filter((studio) => query.get("includeArchived") === "true" || !studio.archived)),
    "GET /api/coaches": ({ query }) =>
      json(coaches.filter((coach) => query.get("includeArchived") === "true" || !coach.archived)),
    "POST /api/workouts": ({ body }) => json(created(body as Record<string, unknown>), 201),
    ...overrides,
  });
}

async function openDialog(api: ReturnType<typeof mockApi>, options: RenderOptions = {}) {
  const user = userEvent.setup();
  const view = renderApp({ path: "/schedule", roles: ["reception"], fetch: api, ...options });
  await user.click(await screen.findByRole("button", { name: "New workout" }));
  const dialog = await screen.findByRole("dialog", { name: "New workout" });
  await waitFor(() => expect(within(dialog).getAllByRole("option").length).toBeGreaterThan(4));
  return { user, dialog, ...view };
}

function setTimes(dialog: HTMLElement, start: string, end: string) {
  fireEvent.change(within(dialog).getByLabelText("Starts"), { target: { value: start } });
  fireEvent.change(within(dialog).getByLabelText("Ends"), { target: { value: end } });
}

async function fillValid(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  title = "Hatha yoga",
) {
  await user.type(within(dialog).getByLabelText("Title"), title);
  await user.selectOptions(within(dialog).getByLabelText("Studio"), YOGA);
  await user.selectOptions(within(dialog).getByLabelText("Coach"), IVAN);
  fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: futureDay } });
  setTimes(dialog, "10:00", "11:00");
}

describe("opening the dialog", () => {
  it("is offered to the front desk but not to coaches", async () => {
    renderApp({ path: "/schedule", roles: ["coach"], fetch: scheduleApi() });
    await screen.findByRole("heading", { name: "Schedule" });

    expect(screen.queryByRole("button", { name: "New workout" })).not.toBeInTheDocument();
  });

  it("offers only studios and coaches that are still active", async () => {
    const { dialog } = await openDialog(scheduleApi());

    const studio = within(dialog).getByLabelText("Studio");
    expect(
      within(studio)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a studio", "Main hall", "Yoga room"]);
    const coach = within(dialog).getByLabelText("Coach");
    expect(
      within(coach)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Choose a coach", "Ivan Petrenko", "Olha Koval"]);
  });
});

describe("scheduling", () => {
  it("sends the workout and jumps to its week", async () => {
    const api = scheduleApi();
    const { user, dialog, router } = await openDialog(api);

    await fillValid(user, dialog);
    await user.type(within(dialog).getByLabelText("Places"), "12");
    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(await screen.findByText("Hatha yoga scheduled")).toBeInTheDocument();
    expect(api.calls("POST", "/api/workouts")[0]?.body).toEqual({
      title: "Hatha yoga",
      kind: "group",
      studioId: YOGA,
      coachId: IVAN,
      date: futureDay,
      startTime: "10:00",
      endTime: "11:00",
      capacity: 12,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ week: mondayOf(futureDay) }),
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("leaves the places out when empty and for a personal session", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog, "Evening stretch");

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));
    await screen.findByText("Evening stretch scheduled");

    expect(api.calls("POST", "/api/workouts")[0]?.body).not.toHaveProperty("capacity");
  });

  it("hides the places field for a personal session and sends no capacity", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog, "Personal training");
    await user.type(within(dialog).getByLabelText("Places"), "5");

    await user.selectOptions(within(dialog).getByLabelText("Type"), "individual");

    expect(within(dialog).queryByLabelText("Places")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));
    await screen.findByText("Personal training scheduled");
    expect(api.calls("POST", "/api/workouts")[0]?.body).toMatchObject({ kind: "individual" });
    expect(api.calls("POST", "/api/workouts")[0]?.body).not.toHaveProperty("capacity");
  });

  it("shows the studio's size next to the places field", async () => {
    const { user, dialog } = await openDialog(scheduleApi());

    await user.selectOptions(within(dialog).getByLabelText("Studio"), MAIN);

    expect(
      within(dialog).getByText("Leave empty to use all 30 places of the studio."),
    ).toBeInTheDocument();
  });
});

describe("checking the form", () => {
  it("asks for what is missing", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(
      await within(dialog).findByText("Enter a title of at least 2 characters"),
    ).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("alert")
        .map((alert) => alert.textContent),
    ).toEqual(["Enter a title of at least 2 characters", "Choose a studio", "Choose a coach"]);
    expect(api.calls("POST", "/api/workouts")).toHaveLength(0);
  });

  it("refuses an end before the start", async () => {
    const { user, dialog } = await openDialog(scheduleApi());
    await fillValid(user, dialog);
    setTimes(dialog, "11:00", "10:00");

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(await within(dialog).findByText("Must end after it starts")).toBeInTheDocument();
  });

  it("refuses a date in the past", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog);
    fireEvent.change(within(dialog).getByLabelText("Date"), {
      target: { value: addDays(today, -1) },
    });

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(await within(dialog).findByText("The date cannot be in the past")).toBeInTheDocument();
    expect(api.calls("POST", "/api/workouts")).toHaveLength(0);
  });

  it("refuses more places than the studio holds", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog);
    await user.type(within(dialog).getByLabelText("Places"), "15");

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(await within(dialog).findByText("Yoga room holds 14 people")).toBeInTheDocument();
    expect(api.calls("POST", "/api/workouts")).toHaveLength(0);
  });
});

describe("coach hours", () => {
  it("warns when the coach does not work then but still lets the front desk decide", async () => {
    const api = scheduleApi();
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog);
    await user.selectOptions(within(dialog).getByLabelText("Coach"), OLHA);

    const warning = await within(dialog).findByRole("status");
    expect(warning).toHaveTextContent("Olha Koval is not scheduled to work then.");

    await user.selectOptions(within(dialog).getByLabelText("Coach"), IVAN);
    await waitFor(() => expect(within(dialog).queryByRole("status")).not.toBeInTheDocument());
  });

  it("names the coach's hours on that day when they have some", async () => {
    const { user, dialog } = await openDialog(scheduleApi());
    await user.type(within(dialog).getByLabelText("Title"), "Morning yoga");
    await user.selectOptions(within(dialog).getByLabelText("Coach"), OLHA);
    const monday = mondayOf(addDays(today, 14));
    fireEvent.change(within(dialog).getByLabelText("Date"), { target: { value: monday } });
    setTimes(dialog, "16:00", "17:00");

    expect(await within(dialog).findByRole("status")).toHaveTextContent(
      "Their hours that day: 09:00–15:00.",
    );
  });
});

describe("server answers", () => {
  it("shows why the server refused the workout", async () => {
    const api = scheduleApi({
      "POST /api/workouts": () => problem(400, "The studio is already booked at that time"),
    });
    const { user, dialog } = await openDialog(api);
    await fillValid(user, dialog);

    await user.click(within(dialog).getByRole("button", { name: "Schedule workout" }));

    expect(
      await within(dialog).findByText("The studio is already booked at that time"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
