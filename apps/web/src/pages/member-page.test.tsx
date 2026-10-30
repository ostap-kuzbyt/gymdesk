import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import {
  ACTIVE_SUB,
  IVAN,
  MEMBER_ID,
  MONTHLY,
  OLHA,
  baseMember,
  openProfile,
  profileApi,
  today,
} from "@/test/member-fixtures";

describe("profile", () => {
  it("shows contact details and the current subscription", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state);

    expect(screen.getByText("32 years old")).toBeInTheDocument();
    expect(screen.getByText("olena@example.com")).toBeInTheDocument();
    expect(screen.getByText("+380501234567")).toBeInTheDocument();
    expect(screen.getByText(/Active until/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "19 days left" }).length).toBeGreaterThan(0);
  });

  it("lists subscriptions newest first with tariff names, status and price", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state);

    const rows = await screen.findAllByRole("row", { name: /Monthly|Quarterly/ });
    expect(rows.map((row) => within(row).getAllByRole("cell")[1]?.firstChild?.textContent)).toEqual(
      ["Monthly", "Quarterly"],
    );
    expect(within(rows[0] as HTMLElement).getByText("Active")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getAllByText(/49\.00/).length).toBeGreaterThan(0);
    expect(within(rows[1] as HTMLElement).getByText("Ended")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getAllByText(/20 visits/).length).toBeGreaterThan(0);
  });

  it("explains when there are no subscriptions or visits", async () => {
    const state = baseMember({ subscriptions: [] });
    await openProfile(profileApi(state), state);

    expect(
      await screen.findByRole("heading", { name: "No subscriptions yet" }),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "No visits yet" })).toBeInTheDocument();
    expect(screen.getByText("No active subscription")).toBeInTheDocument();
  });

  it("shows a subscription that has not started yet", async () => {
    const state = baseMember({
      subscriptions: [
        {
          id: ACTIVE_SUB,
          tariffId: MONTHLY,
          startsOn: addDays(today, 5),
          endsOn: addDays(today, 34),
          priceCents: 4900,
          visitLimit: null,
          cancelledOn: null,
          status: "upcoming",
        },
      ],
    });
    await openProfile(profileApi(state), state);

    expect(screen.getByText(/^Starts \d/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Starts in 5 days" }).length).toBeGreaterThan(0);
  });

  it("says when the member does not exist", async () => {
    const api = mockApi({ "GET /api/members/:id": () => problem(404, "Member was not found") });
    renderApp({ path: `/members/${MEMBER_ID}`, roles: ["reception"], fetch: api });

    expect(await screen.findByRole("heading", { name: "Member not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to members" })).toHaveAttribute(
      "href",
      "/members",
    );
  });

  it("explains a loading failure and retries", async () => {
    const state = baseMember();
    let failing = true;
    const api = profileApi(state, {
      overrides: {
        "GET /api/members/:id": () =>
          failing ? problem(503, "The database is restarting") : json(state),
      },
    });
    const user = userEvent.setup();
    renderApp({ path: `/members/${MEMBER_ID}`, roles: ["reception"], fetch: api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Olena Shevchenko" })).toBeInTheDocument();
  });
});

describe("visits", () => {
  it("lists visits with the time of arrival and pages through older ones", async () => {
    const state = baseMember();
    const api = profileApi(state, { visits: 12 });
    const { user } = await openProfile(api, state);

    expect(await screen.findByText("1–10 of 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Newer" })).toBeDisabled();
    const firstRow = screen
      .getAllByRole("row", { name: /Monthly/ })
      .find((row) => row.textContent?.includes(":"));
    expect(firstRow).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Older" }));

    expect(await screen.findByText("11–12 of 12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Older" })).toBeDisabled();
    expect(
      api.urls("GET").some((url) => url.includes("check-ins") && url.includes("offset=10")),
    ).toBe(true);
  });
});

describe("check in", () => {
  it("checks the member in from the profile", async () => {
    const state = baseMember();
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    await user.click(screen.getByRole("button", { name: "Check in" }));

    expect(await screen.findByText("Olena Shevchenko checked in")).toBeInTheDocument();
    expect(api.calls("POST", `/api/members/${MEMBER_ID}/check-ins`)).toHaveLength(1);
  });

  it("shows why a check-in was refused", async () => {
    const state = baseMember();
    const api = profileApi(state, {
      overrides: {
        "POST /api/members/:id/check-ins": () =>
          problem(400, "Member has no active subscription on today"),
      },
    });
    const { user } = await openProfile(api, state);

    await user.click(screen.getByRole("button", { name: "Check in" }));

    expect(
      await screen.findByText("Member has no active subscription on today"),
    ).toBeInTheDocument();
  });

  it("keeps coaches read-only", async () => {
    const state = baseMember({ coachId: IVAN });
    await openProfile(profileApi(state), state, { roles: ["coach"] });

    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(await screen.findByText("Ivan Petrenko")).toBeInTheDocument();
  });
});

describe("editing", () => {
  it("prefills the form and saves with the version it was loaded at", async () => {
    const state = baseMember();
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Olena Shevchenko" });
    expect(within(dialog).getByLabelText("Email")).toHaveValue("olena@example.com");
    expect(within(dialog).getByLabelText("Phone")).toHaveValue("+380501234567");

    await user.clear(within(dialog).getByLabelText("Phone"));
    await user.clear(within(dialog).getByLabelText("Full name"));
    await user.type(within(dialog).getByLabelText("Full name"), "Olena Kovalenko");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Olena Kovalenko updated")).toBeInTheDocument();
    expect(api.calls("PATCH", "/api/members/")[0]?.body).toEqual({
      fullName: "Olena Kovalenko",
      birthDate: "1994-05-17",
      email: "olena@example.com",
      phone: null,
      version: 1,
    });
    expect(await screen.findByRole("heading", { name: "Olena Kovalenko" })).toBeInTheDocument();
  });

  it("shows a conflict from the server", async () => {
    const state = baseMember();
    const api = profileApi(state, {
      overrides: {
        "PATCH /api/members/:id": () =>
          problem(409, "The member was changed by someone else, reload and try again"),
      },
    });
    const { user } = await openProfile(api, state);
    await user.click(screen.getByRole("button", { name: "Edit profile" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(
      await within(dialog).findByText(
        "The member was changed by someone else, reload and try again",
      ),
    ).toBeInTheDocument();
  });
});

describe("coach", () => {
  it("shows the assigned coach and lets the front desk change it", async () => {
    const state = baseMember({ coachId: IVAN });
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    const select = await screen.findByRole("combobox", { name: "Coach" });
    await waitFor(() => expect(select).toHaveValue(IVAN));

    await user.selectOptions(select, OLHA);

    expect(await screen.findByText("Coach assigned")).toBeInTheDocument();
    expect(api.calls("PUT", "/api/members/")[0]?.body).toEqual({ coachId: OLHA });
  });

  it("removes the coach with the empty option", async () => {
    const state = baseMember({ coachId: IVAN });
    const api = profileApi(state);
    const { user } = await openProfile(api, state);
    const select = await screen.findByRole("combobox", { name: "Coach" });
    await waitFor(() => expect(select).toHaveValue(IVAN));

    await user.selectOptions(select, "");

    expect(await screen.findByText("Coach removed")).toBeInTheDocument();
    expect(api.calls("PUT", "/api/members/")[0]?.body).toEqual({ coachId: null });
  });

  it("explains why a coach could not be assigned", async () => {
    const state = baseMember();
    const api = profileApi(state, {
      overrides: {
        "PUT /api/members/:id/coach": () => problem(400, "The coach has been archived"),
      },
    });
    const { user } = await openProfile(api, state);
    const select = await screen.findByRole("combobox", { name: "Coach" });
    await waitFor(() => expect(select).not.toBeDisabled());

    await user.selectOptions(select, OLHA);

    expect(await screen.findByText("The coach has been archived")).toBeInTheDocument();
  });
});

describe("sending a reminder", () => {
  it("opens the dialog with the member already chosen", async () => {
    const state = baseMember();
    const api = profileApi(state, {
      overrides: {
        "POST /api/members/:id/reminders": () =>
          json(
            {
              id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0888",
              memberId: MEMBER_ID,
              memberName: "Olena Shevchenko",
              subscriptionId: ACTIVE_SUB,
              kind: "expiry",
              trigger: "manual",
              email: "olena@example.com",
              status: "sent",
              attempts: 1,
              error: null,
              createdAt: new Date().toISOString(),
              sentAt: new Date().toISOString(),
            },
            201,
          ),
      },
    });
    const { user } = await openProfile(api, state);

    await user.click(screen.getByRole("button", { name: "Send reminder" }));
    const dialog = await screen.findByRole("dialog", { name: "Send a reminder" });

    expect(within(dialog).getByText("Olena Shevchenko")).toBeInTheDocument();
    expect(within(dialog).queryByRole("searchbox")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Change" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Send reminder" }));
    expect(await screen.findByText("Reminder sent to Olena Shevchenko")).toBeInTheDocument();
    expect(api.calls("POST", `/api/members/${MEMBER_ID}/reminders`)[0]?.body).toEqual({
      kind: "expiry",
    });
  });

  it("is not offered to coaches", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state, { roles: ["coach"] });

    expect(screen.queryByRole("button", { name: "Send reminder" })).not.toBeInTheDocument();
  });
});
