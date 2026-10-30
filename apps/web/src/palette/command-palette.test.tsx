import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const OLENA = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1111",
  fullName: "Olena Shevchenko",
  age: 32,
  email: "olena@example.com",
  phone: null,
  activeUntil: "2026-11-19",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function backend(overrides: { checkIn?: () => Response; members?: unknown[] } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/members?")) {
      return json({
        items: overrides.members ?? [OLENA],
        total: (overrides.members ?? [OLENA]).length,
      });
    }
    if (url.endsWith("/check-ins") && init?.method === "POST") {
      return (
        overrides.checkIn?.() ??
        json(
          {
            id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2222",
            memberId: OLENA.id,
            subscriptionId: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b3333",
            visitDate: "2026-10-21",
            checkedInAt: "2026-10-21T09:15:00.000Z",
          },
          { status: 201 },
        )
      );
    }
    return json({ detail: "Not found" }, { status: 404 });
  });
}

async function openPalette(options: RenderOptions = {}) {
  const user = userEvent.setup();
  const view = renderApp(options);
  await screen.findByRole("heading", { name: "Today" });
  await user.keyboard("{Control>}k{/Control}");
  const dialog = await screen.findByRole("dialog");
  return { user, dialog, ...view };
}

const optionLabels = (container: HTMLElement) =>
  within(container)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("opening", () => {
  it("opens with Ctrl+K and closes with Escape", async () => {
    const { user } = await openPalette();

    expect(screen.getByPlaceholderText("Type a member's name or a page")).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("opens from the search button in the top bar", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("heading", { name: "Today" });

    await user.click(
      screen.getAllByRole("button", { name: /Search or jump to/ })[0] as HTMLElement,
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("pages", () => {
  it("lists the pages of the user's role", async () => {
    const { dialog } = await openPalette({ roles: ["coach"] });

    expect(optionLabels(dialog)).toEqual([
      "Today",
      "Members",
      "Schedule",
      "Tariffs",
      "Studios",
      "Coaches",
      "Theme: system. Switch",
    ]);
  });

  it("filters the pages as you type and jumps to the chosen one", async () => {
    const { user, dialog } = await openPalette({ roles: ["admin"], fetch: backend() });

    await user.type(screen.getByRole("combobox"), "rep");
    expect(optionLabels(dialog)).toContain("Reports");
    expect(within(dialog).queryByRole("option", { name: "Members" })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not offer a page the role cannot open", async () => {
    const { user, dialog } = await openPalette({ roles: ["coach"] });

    await user.type(screen.getByRole("combobox"), "report");

    expect(within(dialog).queryByRole("option", { name: "Reports" })).not.toBeInTheDocument();
    expect(await within(dialog).findByText(/Nothing matches/)).toBeInTheDocument();
  });
});

describe("members", () => {
  it("searches members once two characters are typed", async () => {
    const fetchMock = backend();
    const { user } = await openPalette({ fetch: fetchMock });

    await user.type(screen.getByRole("combobox"), "o");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const searches = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/members?q="));
    expect(searches()).toHaveLength(0);

    await user.type(screen.getByRole("combobox"), "le");
    await waitFor(() => expect(searches()).toHaveLength(1));

    const [url, init] = searches()[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/members?q=ole&limit=5");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-token" });
  });

  it("offers to check the member in and to open the profile", async () => {
    const { user, dialog } = await openPalette({ fetch: backend() });

    await user.type(screen.getByRole("combobox"), "olena");

    const checkIn = await within(dialog).findByRole("group", { name: "Check in" });
    expect(within(checkIn).getByText("Olena Shevchenko")).toBeInTheDocument();
    expect(within(checkIn).getByText("olena@example.com")).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Open profile" })).toBeInTheDocument();
  });

  it("checks the member in and confirms with a toast", async () => {
    const fetchMock = backend();
    const { user, dialog } = await openPalette({ fetch: fetchMock });
    await user.type(screen.getByRole("combobox"), "olena");

    const checkIn = await within(dialog).findByRole("group", { name: "Check in" });
    await user.click(within(checkIn).getByRole("option"));

    expect(await screen.findByText("Olena Shevchenko checked in")).toBeInTheDocument();
    expect(screen.getByText(/Arrived at/)).toBeInTheDocument();
    const posted = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(String(posted?.[0])).toBe(`/api/members/${OLENA.id}/check-ins`);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the reason when the check-in is refused", async () => {
    const fetchMock = backend({
      checkIn: () =>
        json({ detail: "Member has already checked in on 2026-10-21" }, { status: 409 }),
    });
    const { user, dialog } = await openPalette({ fetch: fetchMock });
    await user.type(screen.getByRole("combobox"), "olena");

    await user.click(
      within(await within(dialog).findByRole("group", { name: "Check in" })).getByRole("option"),
    );

    expect(await screen.findByText("Olena Shevchenko was not checked in")).toBeInTheDocument();
    expect(screen.getByText("Member has already checked in on 2026-10-21")).toBeInTheDocument();
  });

  it("opens the member's profile", async () => {
    const { user, dialog, router } = await openPalette({ fetch: backend() });
    await user.type(screen.getByRole("combobox"), "olena");

    await user.click(
      within(await within(dialog).findByRole("group", { name: "Open profile" })).getByRole(
        "option",
      ),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe(`/members/${OLENA.id}`));
  });

  it("lets a coach open a profile but not check anyone in", async () => {
    const { user, dialog } = await openPalette({ roles: ["coach"], fetch: backend() });

    await user.type(screen.getByRole("combobox"), "olena");

    expect(await within(dialog).findByRole("group", { name: "Open profile" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "Check in" })).not.toBeInTheDocument();
  });
});

describe("appearance", () => {
  it("switches the theme from the palette", async () => {
    const { user, dialog } = await openPalette();

    await user.click(within(dialog).getByRole("option", { name: /Theme: system/ }));

    expect(await within(dialog).findByRole("option", { name: /Theme: light/ })).toBeInTheDocument();
  });
});
