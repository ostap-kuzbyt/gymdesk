import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const today = todayLocal();

interface Row {
  id: string;
  fullName: string;
  age: number;
  email: string;
  phone: string | null;
  activeUntil: string | null;
}

const OLENA: Row = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1001",
  fullName: "Olena Shevchenko",
  age: 32,
  email: "olena@example.com",
  phone: null,
  activeUntil: addDays(today, 12),
};
const TARAS: Row = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1002",
  fullName: "Taras Melnyk",
  age: 41,
  email: "taras@example.com",
  phone: null,
  activeUntil: null,
};

function attendance(names: { memberId: string; fullName: string }[]) {
  return {
    from: today,
    to: today,
    total: names.length,
    items: [
      ...names.map((item) => ({
        ...item,
        email: "x@example.com",
        visits: 1,
        lastVisitOn: today,
        activeUntil: null,
      })),
      {
        memberId: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1999",
        fullName: "Never Visited",
        email: "n@example.com",
        visits: 0,
        lastVisitOn: null,
        activeUntil: null,
      },
    ],
  };
}

function deskApi(rows: Row[], overrides: Parameters<typeof mockApi>[0] = {}) {
  const arrived: { memberId: string; fullName: string }[] = [];
  return mockApi({
    "GET /api/members": ({ query }) => {
      const q = (query.get("q") ?? "").toLowerCase();
      const items = rows.filter(
        (row) => row.fullName.toLowerCase().includes(q) || row.email.includes(q),
      );
      return json({ items, total: items.length });
    },
    "GET /api/reports/attendance": () => json(attendance(arrived)),
    "POST /api/members/:id/check-ins": ({ params }) => {
      const row = rows.find((item) => item.id === params.id);
      if (row) arrived.push({ memberId: row.id, fullName: row.fullName });
      return json(
        {
          id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2999",
          memberId: params.id,
          subscriptionId: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b3999",
          visitDate: today,
          checkedInAt: new Date(2026, 9, 21, 9, 5).toISOString(),
        },
        201,
      );
    },
    ...overrides,
  });
}

async function openDesk(api: ReturnType<typeof mockApi>, options: RenderOptions = {}) {
  const user = userEvent.setup();
  const view = renderApp({ path: "/check-in", roles: ["reception"], fetch: api, ...options });
  await screen.findByRole("heading", { name: "Check-in" });
  return { user, ...view };
}

describe("check-in desk", () => {
  it("is only for the front desk", async () => {
    renderApp({ path: "/check-in", roles: ["coach"], fetch: deskApi([OLENA]) });

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
  });

  it("puts the cursor in the search box and explains what to type", async () => {
    await openDesk(deskApi([OLENA]));

    expect(screen.getByRole("searchbox", { name: "Find a member" })).toHaveFocus();
    expect(screen.getByText(/Type at least two letters/)).toBeInTheDocument();
  });

  it("shows who arrived today and says so when nobody has", async () => {
    await openDesk(deskApi([OLENA]));

    expect(await screen.findByText("Nobody has checked in yet today.")).toBeInTheDocument();
  });

  it("asks for today's attendance only", async () => {
    const api = deskApi([OLENA]);
    await openDesk(api);

    await waitFor(() =>
      expect(api.urls("GET").some((url) => url.startsWith("/api/reports/attendance"))).toBe(true),
    );
    const url =
      api.urls("GET").find((candidate) => candidate.startsWith("/api/reports/attendance")) ?? "";
    expect(url).toContain(`from=${today}`);
    expect(url).toContain(`to=${today}`);
  });
});

describe("finding members", () => {
  it("lists matches with their subscription and a check-in button for those who can come in", async () => {
    const { user } = await openDesk(deskApi([OLENA, TARAS]));

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "a");
    expect(screen.queryByRole("button", { name: /Check in/ })).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "s");
    expect(screen.queryByText("Olena Shevchenko")).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Find a member" }));
    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "ta");

    const taras = await screen.findByText("Taras Melnyk");
    const row = taras.closest("li") as HTMLElement;
    expect(within(row).getByText("No active subscription")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open profile to sell one" })).toHaveAttribute(
      "href",
      `/members/${TARAS.id}`,
    );
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers the check-in to a member with an active subscription", async () => {
    const { user } = await openDesk(deskApi([OLENA, TARAS]));

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "olena");

    expect(
      await screen.findByRole("button", { name: "Check in Olena Shevchenko" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "12 days left" })).toBeInTheDocument();
    expect(screen.getByText("Press Enter to check in Olena Shevchenko.")).toBeInTheDocument();
  });

  it("says when nobody matches and points to the members page", async () => {
    const { user } = await openDesk(deskApi([OLENA]));

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "zzz");

    expect(await screen.findByRole("heading", { name: "Nobody found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to members" })).toHaveAttribute("href", "/members");
  });

  it("explains a search failure", async () => {
    const api = deskApi([OLENA], {
      "GET /api/members": () => problem(503, "The database is restarting"),
    });
    const { user } = await openDesk(api);

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "olena");

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
  });
});

describe("checking someone in", () => {
  it("checks the member in with the button, clears the search and lists them as arrived", async () => {
    const api = deskApi([OLENA, TARAS]);
    const { user } = await openDesk(api);
    const box = screen.getByRole("searchbox", { name: "Find a member" });

    await user.type(box, "olena");
    await user.click(await screen.findByRole("button", { name: "Check in Olena Shevchenko" }));

    expect(await screen.findByText("Olena Shevchenko checked in")).toBeInTheDocument();
    expect(api.calls("POST", `/api/members/${OLENA.id}/check-ins`)).toHaveLength(1);
    await waitFor(() => expect(box).toHaveValue(""));
    expect(box).toHaveFocus();

    const aside = screen.getByRole("complementary", { name: "Arrived today" });
    expect(await within(aside).findByText("Olena Shevchenko")).toBeInTheDocument();
    expect(within(aside).getByText("1 member")).toBeInTheDocument();
    expect(within(aside).getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    expect(within(aside).queryByText("Never Visited")).not.toBeInTheDocument();
  });

  it("checks in the first eligible match when Enter is pressed", async () => {
    const api = deskApi([
      TARAS,
      {
        ...OLENA,
        fullName: "Tamara Olenko",
        id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1003",
        email: "ta.olenko@example.com",
      },
    ]);
    const { user } = await openDesk(api);

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "ta");
    await screen.findByText("Tamara Olenko");
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Tamara Olenko checked in")).toBeInTheDocument();
    expect(
      api.calls("POST", "/api/members/6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1003/check-ins"),
    ).toHaveLength(1);
    expect(api.calls("POST", `/api/members/${TARAS.id}/check-ins`)).toHaveLength(0);
  });

  it("does nothing on Enter when nobody can be checked in", async () => {
    const api = deskApi([TARAS]);
    const { user } = await openDesk(api);

    await user.type(screen.getByRole("searchbox", { name: "Find a member" }), "taras");
    await screen.findByText("Taras Melnyk");
    await user.keyboard("{Enter}");

    expect(api.calls("POST", "/api/members/")).toHaveLength(0);
  });

  it("keeps the search and explains why the check-in was refused", async () => {
    const api = deskApi([OLENA], {
      "POST /api/members/:id/check-ins": () =>
        problem(409, "Member has already checked in on today"),
    });
    const { user } = await openDesk(api);
    const box = screen.getByRole("searchbox", { name: "Find a member" });

    await user.type(box, "olena");
    await user.click(await screen.findByRole("button", { name: "Check in Olena Shevchenko" }));

    expect(await screen.findByText("Member has already checked in on today")).toBeInTheDocument();
    expect(box).toHaveValue("olena");
  });
});

describe("arrivals panel", () => {
  it("counts people in the plural", async () => {
    const api = deskApi([OLENA], {
      "GET /api/reports/attendance": () =>
        json(
          attendance([
            { memberId: OLENA.id, fullName: "Olena Shevchenko" },
            { memberId: TARAS.id, fullName: "Taras Melnyk" },
          ]),
        ),
    });
    await openDesk(api);

    const aside = screen.getByRole("complementary", { name: "Arrived today" });
    expect(await within(aside).findByText("2 members")).toBeInTheDocument();
  });

  it("explains a failure to load arrivals", async () => {
    const api = deskApi([OLENA], {
      "GET /api/reports/attendance": () => problem(500, "Reports are unavailable"),
    });
    await openDesk(api);

    expect(await screen.findByText("Reports are unavailable")).toBeInTheDocument();
  });
});
