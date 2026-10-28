import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { todayLocal } from "@/lib/format";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

const COACH_ID = "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b2001";
const today = todayLocal();

const coach = {
  id: COACH_ID,
  fullName: "Ivan Petrenko",
  specialization: "Strength training",
  weeklyHours: [
    { weekday: 1, from: "07:00", to: "13:00" },
    { weekday: 1, from: "16:00", to: "20:00" },
    { weekday: 3, from: "09:00", to: "12:00" },
  ],
  archived: false,
  version: 2,
};

function memberRow(index: number) {
  return {
    id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(3000 + index)}`,
    fullName: `Client ${String(index).padStart(2, "0")}`,
    age: 30,
    email: `client${index}@example.com`,
    phone: null,
    activeUntil: index % 2 === 0 ? addDays(today, 20) : null,
  };
}

function coachApi(members = 0, overrides: Parameters<typeof mockApi>[0] = {}) {
  const all = Array.from({ length: members }, (_, index) => memberRow(index + 1));
  return mockApi({
    "GET /api/coaches/:id": () => json(coach),
    "GET /api/coaches/:id/members": ({ query }) => {
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 10);
      return json({ items: all.slice(offset, offset + limit), total: all.length });
    },
    "POST /api/coaches/:id/archive": () => json({ ...coach, archived: true, version: 3 }),
    ...overrides,
  });
}

async function openPage(api: ReturnType<typeof mockApi>, options: RenderOptions = {}) {
  const user = userEvent.setup();
  const view = renderApp({
    path: `/coaches/${COACH_ID}`,
    roles: ["admin"],
    fetch: api,
    ...options,
  });
  await screen.findByRole("heading", { name: "Ivan Petrenko" });
  return { user, ...view };
}

describe("coach profile", () => {
  it("shows the specialization and the hours of every weekday", async () => {
    await openPage(coachApi());

    expect(screen.getByText("Strength training")).toBeInTheDocument();
    expect(screen.getByText("07:00–13:00, 16:00–20:00")).toBeInTheDocument();
    expect(screen.getByText("09:00–12:00")).toBeInTheDocument();
    expect(screen.getAllByText("Day off")).toHaveLength(5);
  });

  it("says when the coach does not exist", async () => {
    const api = mockApi({ "GET /api/coaches/:id": () => problem(404, "Coach was not found") });
    renderApp({ path: `/coaches/${COACH_ID}`, roles: ["admin"], fetch: api });

    expect(await screen.findByRole("heading", { name: "Coach not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to coaches" })).toHaveAttribute(
      "href",
      "/coaches",
    );
  });

  it("lets an admin edit or archive, but not other roles", async () => {
    await openPage(coachApi());
    expect(screen.getByRole("button", { name: "Edit coach" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("keeps the profile read-only for the front desk", async () => {
    await openPage(coachApi(), { roles: ["reception"] });

    expect(screen.queryByRole("button", { name: "Edit coach" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("archives the coach after confirmation", async () => {
    const api = coachApi();
    const { user } = await openPage(api);

    await user.click(screen.getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Archive Ivan Petrenko?" });
    await user.click(within(confirm).getByRole("button", { name: "Archive coach" }));

    expect(await screen.findByText("Ivan Petrenko archived")).toBeInTheDocument();
    expect(api.calls("POST", "/api/coaches/")).toHaveLength(1);
  });
});

describe("assigned members", () => {
  it("lists members with their subscription and pages through them", async () => {
    const api = coachApi(12);
    const { user } = await openPage(api);

    expect(await screen.findByText("1–10 of 12")).toBeInTheDocument();
    const first = screen.getByRole("row", { name: /Client 01/ });
    expect(within(first).getByRole("link", { name: "Client 01" })).toHaveAttribute(
      "href",
      expect.stringContaining("/members/"),
    );
    expect(within(first).getByText("No active subscription")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Client 02/ })).getByText(/until/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("11–12 of 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("explains an empty list", async () => {
    await openPage(coachApi(0));

    expect(await screen.findByRole("heading", { name: "No members assigned" })).toBeInTheDocument();
  });
});
