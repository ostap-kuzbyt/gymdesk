import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

interface Row {
  id: string;
  fullName: string;
  age: number;
  email: string;
  phone: string | null;
  activeUntil: string | null;
}

const today = todayLocal();

function member(index: number, overrides: Partial<Row> = {}): Row {
  return {
    id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(index).padStart(4, "0")}`,
    fullName: `Member ${String(index).padStart(2, "0")}`,
    age: 20 + index,
    email: `member${index}@example.com`,
    phone: null,
    activeUntil: null,
    ...overrides,
  };
}

function membersApi(all: Row[], overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/members": ({ query }) => {
      const q = (query.get("q") ?? "").toLowerCase();
      const matching = all.filter(
        (row) => row.fullName.toLowerCase().includes(q) || row.email.toLowerCase().includes(q),
      );
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 25);
      return { body: { items: matching.slice(offset, offset + limit), total: matching.length } };
    },
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  const view = renderApp({ path: "/members", roles: ["reception"], fetch: api, ...rest });
  await screen.findByRole("heading", { name: "Members" });
  return { user, ...view };
}

describe("member list", () => {
  it("shows contact details and the state of each subscription", async () => {
    const api = membersApi([
      member(1, {
        fullName: "Olena Shevchenko",
        phone: "+380501234567",
        activeUntil: addDays(today, 20),
      }),
      member(2, { fullName: "Andriy Bondar", activeUntil: addDays(today, 3) }),
      member(3, { fullName: "Taras Melnyk" }),
    ]);
    await openPage({ api });

    const olena = await screen.findByRole("row", { name: /Olena Shevchenko/ });
    expect(within(olena).getByRole("link", { name: "Olena Shevchenko" })).toHaveAttribute(
      "href",
      "/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0001",
    );
    expect(within(olena).getByText("+380501234567")).toBeInTheDocument();
    expect(within(olena).getByRole("img", { name: "20 days left" })).toBeInTheDocument();

    const andriy = screen.getByRole("row", { name: /Andriy Bondar/ });
    expect(within(andriy).getByRole("img", { name: "3 days left" })).toBeInTheDocument();

    expect(
      within(screen.getByRole("row", { name: /Taras Melnyk/ })).getByText("No active subscription"),
    ).toBeInTheDocument();
  });

  it("asks for the first page of 25 members", async () => {
    const api = membersApi([member(1)]);
    await openPage({ api });
    await screen.findByText("Member 01");

    expect(api.urls("GET")).toEqual(["/api/members?limit=25&offset=0"]);
  });

  it("explains an empty club to the front desk and to coaches", async () => {
    await openPage({ api: membersApi([]) });
    expect(await screen.findByRole("heading", { name: "No members yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Register member" })).toHaveLength(2);
  });

  it("tells a coach that the front desk registers members", async () => {
    await openPage({ roles: ["coach"], api: membersApi([]) });

    expect(await screen.findByText(/once the front desk registers them/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register member" })).not.toBeInTheDocument();
  });

  it("explains a loading failure and recovers on retry", async () => {
    let failing = true;
    const api = membersApi([member(1)], {
      "GET /api/members": () =>
        failing
          ? problem(503, "The database is restarting")
          : json({ items: [member(1)], total: 1 }),
    });
    const { user } = await openPage({ api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Member 01")).toBeInTheDocument();
  });
});

describe("search", () => {
  const people = [
    member(1, { fullName: "Olena Shevchenko", email: "olena@example.com" }),
    member(2, { fullName: "Olena Kovalenko", email: "kovalenko@example.com" }),
    member(3, { fullName: "Andriy Bondar", email: "andriy@example.com" }),
  ];

  it("filters as you type and keeps the term in the address", async () => {
    const api = membersApi(people);
    const { user, router } = await openPage({ api });
    await screen.findByText("Andriy Bondar");

    await user.type(screen.getByRole("searchbox", { name: "Search members" }), "olena");

    await waitFor(() => expect(screen.queryByText("Andriy Bondar")).not.toBeInTheDocument());
    expect(screen.getByText("Olena Shevchenko")).toBeInTheDocument();
    expect(screen.getByText("Olena Kovalenko")).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ q: "olena" });
  });

  it("starts from the term in the address", async () => {
    const api = membersApi(people);
    await openPage({ path: "/members?q=andriy", api });

    expect(await screen.findByText("Andriy Bondar")).toBeInTheDocument();
    expect(screen.queryByText("Olena Shevchenko")).not.toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search members" })).toHaveValue("andriy");
  });

  it("says when nobody matches", async () => {
    const api = membersApi(people);
    await openPage({ path: "/members?q=zzz", api });

    expect(await screen.findByRole("heading", { name: "No members found" })).toBeInTheDocument();
    expect(screen.getByText(/Nobody matches "zzz"/)).toBeInTheDocument();
  });
});

describe("pages", () => {
  const sixty = Array.from({ length: 60 }, (_, index) => member(index + 1));

  it("shows the range and moves between pages", async () => {
    const api = membersApi(sixty);
    const { user, router } = await openPage({ api });

    expect(await screen.findByText("1–25 of 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText("Member 25")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("26–50 of 60")).toBeInTheDocument();
    expect(screen.getByText("Member 26")).toBeInTheDocument();
    expect(screen.queryByText("Member 25")).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ page: 2 });

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("51–60 of 60")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("26–50 of 60")).toBeInTheDocument();
  });

  it("opens straight on the page named in the address", async () => {
    await openPage({ path: "/members?page=3", api: membersApi(sixty) });

    expect(await screen.findByText("51–60 of 60")).toBeInTheDocument();
  });
});

describe("registering a member", () => {
  async function openDialog(api: ReturnType<typeof mockApi>, options: RenderOptions = {}) {
    const view = await openPage({ api, ...options });
    await view.user.click(await screen.findByRole("button", { name: "Register member" }));
    const dialog = await screen.findByRole("dialog", { name: "Register a member" });
    return { ...view, dialog };
  }

  async function fillIn(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, phone = "") {
    await user.type(within(dialog).getByLabelText("Full name"), "Olena Shevchenko");
    await user.type(within(dialog).getByLabelText("Date of birth"), "1994-05-17");
    await user.type(within(dialog).getByLabelText("Email"), "olena@example.com");
    if (phone) await user.type(within(dialog).getByLabelText("Phone"), phone);
  }

  const created = {
    id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b7777",
    coachId: null,
    fullName: "Olena Shevchenko",
    birthDate: "1994-05-17",
    email: "olena@example.com",
    phone: null,
    age: 32,
    version: 1,
    subscriptions: [],
  };

  it("sends the new member without an empty phone and opens their profile", async () => {
    const api = membersApi([member(1)], {
      "POST /api/members": () => json(created, 201),
    });
    const { user, dialog, router } = await openDialog(api);

    await fillIn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Register member" }));

    expect(await screen.findByText("Olena Shevchenko registered")).toBeInTheDocument();
    expect(api.calls("POST", "/api/members")[0]?.body).toEqual({
      fullName: "Olena Shevchenko",
      birthDate: "1994-05-17",
      email: "olena@example.com",
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(`/members/${created.id}`));
  });

  it("includes a phone number when one is given", async () => {
    const api = membersApi([], {
      "POST /api/members": () => json({ ...created, fullName: "Second Person" }, 201),
    });
    const { user, dialog } = await openDialog(api);

    await fillIn(user, dialog, "+380501234567");
    await user.click(within(dialog).getByRole("button", { name: "Register member" }));

    await screen.findByText("Second Person registered");
    expect(api.calls("POST", "/api/members")[0]?.body).toMatchObject({ phone: "+380501234567" });
  });

  it("explains what to fix before sending anything", async () => {
    const api = membersApi([member(1)]);
    const { user, dialog } = await openDialog(api);

    await user.type(within(dialog).getByLabelText("Phone"), "12345");
    await user.click(within(dialog).getByRole("button", { name: "Register member" }));

    expect(await within(dialog).findByText("Enter the member's full name")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the date of birth")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a valid email address")).toBeInTheDocument();
    expect(within(dialog).getByText(/Use the international format/)).toBeInTheDocument();
    expect(api.calls("POST", "/api/members")).toHaveLength(0);
  });

  it("shows a duplicate email next to the email field", async () => {
    const api = membersApi([member(1)], {
      "POST /api/members": () => problem(409, "The record conflicts with an existing one"),
    });
    const { user, dialog } = await openDialog(api);

    await fillIn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Register member" }));

    expect(
      await within(dialog).findByText("A member with this email already exists"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows the server's reason when the member is not allowed", async () => {
    const api = membersApi([member(1)], {
      "POST /api/members": () => problem(400, "Members must be between 14 and 110 years old"),
    });
    const { user, dialog } = await openDialog(api);

    await fillIn(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Register member" }));

    expect(
      await within(dialog).findByText("Members must be between 14 and 110 years old"),
    ).toBeInTheDocument();
  });
});
