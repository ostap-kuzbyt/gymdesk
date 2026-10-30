import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

interface Coach {
  id: string;
  fullName: string;
  specialization: string;
  authSubject: string | null;
  weeklyHours: { weekday: number; from: string; to: string }[];
  archived: boolean;
  version: number;
}

const ivan: Coach = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2001",
  fullName: "Ivan Petrenko",
  specialization: "Strength training",
  authSubject: null,
  weeklyHours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, from: "07:00", to: "13:00" })),
  archived: false,
  version: 1,
};
const olha: Coach = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2002",
  fullName: "Olha Koval",
  specialization: "Yoga and stretching",
  authSubject: null,
  weeklyHours: [
    { weekday: 1, from: "09:00", to: "15:00" },
    { weekday: 6, from: "10:00", to: "14:00" },
  ],
  archived: false,
  version: 1,
};
const retired: Coach = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2003",
  fullName: "Retired Coach",
  specialization: "Boxing",
  authSubject: null,
  weeklyHours: [],
  archived: true,
  version: 3,
};

function coachApi(initial: Coach[], overrides: Parameters<typeof mockApi>[0] = {}) {
  const coaches = initial.map((coach) => ({ ...coach }));
  return mockApi({
    "GET /api/coaches": ({ query }) => ({
      body: coaches.filter((coach) => query.get("includeArchived") === "true" || !coach.archived),
    }),
    "POST /api/coaches": ({ body }) => {
      const created = {
        id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b21${String(coaches.length).padStart(2, "0")}`,
        archived: false,
        version: 1,
        ...(body as object),
      } as Coach;
      coaches.push(created);
      return { status: 201, body: created };
    },
    "PATCH /api/coaches/:id": ({ params, body }) => {
      const target = coaches.find((coach) => coach.id === params.id) as Coach;
      Object.assign(target, body, { version: target.version + 1 });
      return { body: target };
    },
    "POST /api/coaches/:id/archive": ({ params }) => {
      const target = coaches.find((coach) => coach.id === params.id) as Coach;
      target.archived = true;
      return { body: target };
    },
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  renderApp({ path: "/coaches", roles: ["admin"], fetch: api, ...rest });
  await screen.findByRole("heading", { name: "Coaches" });
  return user;
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("coach list", () => {
  it("shows the specialization and a short summary of the working hours", async () => {
    await openPage({ api: coachApi([ivan, olha, retired]) });

    const ivanRow = await screen.findByRole("row", { name: /Ivan Petrenko/ });
    expect(within(ivanRow).getByText("Strength training")).toBeInTheDocument();
    expect(within(ivanRow).getAllByText("Mon–Fri 07:00–13:00").length).toBeGreaterThan(0);
    expect(within(ivanRow).getByRole("link", { name: "Ivan Petrenko" })).toHaveAttribute(
      "href",
      `/coaches/${ivan.id}`,
    );

    const olhaRow = row("Olha Koval");
    expect(within(olhaRow).getAllByText("Mon 09:00–15:00").length).toBeGreaterThan(0);
    expect(within(olhaRow).getAllByText("Sat 10:00–14:00").length).toBeGreaterThan(0);
    expect(screen.queryByText("Retired Coach")).not.toBeInTheDocument();
  });

  it("shows archived coaches on request and says when no hours are set", async () => {
    const user = await openPage({ api: coachApi([ivan, retired]) });
    await screen.findByText("Ivan Petrenko");

    await user.click(screen.getByRole("switch", { name: "Show archived" }));

    const archivedRow = await screen.findByRole("row", { name: /Retired Coach/ });
    expect(within(archivedRow).getByText("Archived")).toBeInTheDocument();
    expect(within(archivedRow).getAllByText("No hours set").length).toBeGreaterThan(0);
    expect(within(archivedRow).queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets only admins change coaches", async () => {
    await openPage({ roles: ["reception"], api: coachApi([ivan]) });
    await screen.findByText("Ivan Petrenko");

    expect(screen.queryByRole("button", { name: "New coach" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("invites an admin to add the first coach", async () => {
    await openPage({ api: coachApi([]) });

    expect(await screen.findByRole("heading", { name: "No coaches yet" })).toBeInTheDocument();
  });

  it("explains a loading failure and retries", async () => {
    let failing = true;
    const api = coachApi([ivan], {
      "GET /api/coaches": () =>
        failing ? problem(503, "The database is restarting") : json([ivan]),
    });
    const user = await openPage({ api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Ivan Petrenko")).toBeInTheDocument();
  });
});

describe("adding a coach", () => {
  it("sends the coach with the working hours they were given", async () => {
    const api = coachApi([ivan]);
    const user = await openPage({ api });
    await screen.findByText("Ivan Petrenko");

    await user.click(screen.getByRole("button", { name: "New coach" }));
    const dialog = await screen.findByRole("dialog", { name: "New coach" });
    await user.type(within(dialog).getByLabelText("Full name"), "Sofiia Marchuk");
    await user.type(within(dialog).getByLabelText("Specialization"), "Boxing");
    await user.click(within(dialog).getByRole("button", { name: "Add working hours" }));
    await user.selectOptions(within(dialog).getByLabelText("Day for window 1"), "4");
    fireEvent.change(within(dialog).getByLabelText("Start of window 1"), {
      target: { value: "16:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("End of window 1"), {
      target: { value: "21:00" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Add coach" }));

    expect(await screen.findByText("Sofiia Marchuk added")).toBeInTheDocument();
    expect(api.calls("POST", "/api/coaches")[0]?.body).toEqual({
      fullName: "Sofiia Marchuk",
      specialization: "Boxing",
      weeklyHours: [{ weekday: 4, from: "16:00", to: "21:00" }],
      authSubject: null,
    });
    expect((await screen.findAllByText("Thu 16:00–21:00")).length).toBeGreaterThan(0);
  });

  it("proposes a free day for each extra window and lets you remove one", async () => {
    const user = await openPage({ api: coachApi([]) });
    await user.click(
      (await screen.findAllByRole("button", { name: "New coach" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Add working hours" }));
    await user.click(within(dialog).getByRole("button", { name: "Add working hours" }));

    expect(within(dialog).getByLabelText("Day for window 1")).toHaveValue("1");
    expect(within(dialog).getByLabelText("Day for window 2")).toHaveValue("2");

    await user.click(within(dialog).getByRole("button", { name: "Remove window 1" }));
    expect(within(dialog).queryByLabelText("Day for window 2")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Day for window 1")).toHaveValue("2");
  });

  it("explains missing names and overlapping windows before sending", async () => {
    const api = coachApi([]);
    const user = await openPage({ api });
    await user.click(
      (await screen.findAllByRole("button", { name: "New coach" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Add working hours" }));
    await user.click(within(dialog).getByRole("button", { name: "Add working hours" }));
    await user.selectOptions(within(dialog).getByLabelText("Day for window 2"), "1");
    fireEvent.change(within(dialog).getByLabelText("Start of window 2"), {
      target: { value: "12:00" },
    });
    fireEvent.change(within(dialog).getByLabelText("End of window 2"), {
      target: { value: "18:00" },
    });
    await user.click(within(dialog).getByRole("button", { name: "Add coach" }));

    expect(await within(dialog).findByText("Enter the coach's full name")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a specialization")).toBeInTheDocument();
    expect(within(dialog).getByText("Overlaps another window on the same day")).toBeInTheDocument();
    expect(api.calls("POST", "/api/coaches")).toHaveLength(0);
  });

  it("shows the server's explanation when the coach is refused", async () => {
    const api = coachApi([], {
      "POST /api/coaches": () =>
        problem(400, "A coach can have at most 21 working windows per week"),
    });
    const user = await openPage({ api });
    await user.click(
      (await screen.findAllByRole("button", { name: "New coach" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Full name"), "Test Coach");
    await user.type(within(dialog).getByLabelText("Specialization"), "Cycling");

    await user.click(within(dialog).getByRole("button", { name: "Add coach" }));

    expect(
      await within(dialog).findByText("A coach can have at most 21 working windows per week"),
    ).toBeInTheDocument();
  });
});

describe("editing and archiving", () => {
  it("prefills the hours and saves with the version it was opened at", async () => {
    const api = coachApi([olha]);
    const user = await openPage({ api });
    await screen.findByText("Olha Koval");

    await user.click(within(row("Olha Koval")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Olha Koval" });
    expect(within(dialog).getByLabelText("Day for window 1")).toHaveValue("1");
    expect(within(dialog).getByLabelText("Start of window 1")).toHaveValue("09:00");
    expect(within(dialog).getByLabelText("Day for window 2")).toHaveValue("6");

    await user.click(within(dialog).getByRole("button", { name: "Remove window 2" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Olha Koval updated")).toBeInTheDocument();
    expect(api.calls("PATCH", "/api/coaches/")[0]?.body).toMatchObject({
      version: 1,
      weeklyHours: [{ weekday: 1, from: "09:00", to: "15:00" }],
    });
  });

  it("asks first and then removes the coach from the list", async () => {
    const api = coachApi([ivan, olha]);
    const user = await openPage({ api });
    await screen.findByText("Olha Koval");

    await user.click(within(row("Olha Koval")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Archive Olha Koval?" });
    await user.click(within(confirm).getByRole("button", { name: "Archive coach" }));

    expect(await screen.findByText("Olha Koval archived")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Olha Koval/ })).not.toBeInTheDocument(),
    );
  });

  it("explains why archiving failed", async () => {
    const api = coachApi([ivan], {
      "POST /api/coaches/:id/archive": () => problem(409, "The coach was changed by someone else"),
    });
    const user = await openPage({ api });
    await screen.findByText("Ivan Petrenko");

    await user.click(within(row("Ivan Petrenko")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive coach" }));

    expect(
      await within(confirm).findByText("The coach was changed by someone else"),
    ).toBeInTheDocument();
  });
});
