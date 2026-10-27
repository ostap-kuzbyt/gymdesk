import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { problem } from "@/test/mock-api";
import {
  ACTIVE_SUB,
  MONTHLY,
  QUARTERLY,
  baseMember,
  openProfile,
  profileApi,
  today,
} from "@/test/member-fixtures";

async function openSellDialog(
  state = baseMember(),
  overrides: Parameters<typeof profileApi>[1] = {},
) {
  const api = profileApi(state, overrides);
  const view = await openProfile(api, state);
  await view.user.click(screen.getByRole("button", { name: "Sell subscription" }));
  const dialog = await screen.findByRole("dialog", { name: "Sell a subscription" });
  return { ...view, api, state, dialog };
}

describe("selling a subscription", () => {
  it("is offered to the front desk but not to coaches", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state, { roles: ["coach"] });

    expect(screen.queryByRole("button", { name: "Sell subscription" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("offers only tariffs that can still be sold, with their price", async () => {
    const { dialog } = await openSellDialog();
    const select = within(dialog).getByRole("combobox", { name: "Tariff" });

    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options[0]).toBe("Choose a tariff");
    expect(options[1]).toMatch(/Monthly · .*49\.00/);
    expect(within(select).queryByText(/Quarterly/)).not.toBeInTheDocument();
  });

  it("starts right after the current subscription and previews the new period", async () => {
    const { user, dialog } = await openSellDialog();

    const firstDay = addDays(today, 20);
    expect(within(dialog).getByLabelText("First day")).toHaveValue(firstDay);
    expect(
      within(dialog).getByText("Right after the current subscription ends."),
    ).toBeInTheDocument();

    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(within(dialog).getByLabelText("Tariff"), MONTHLY);

    expect(
      within(dialog).getByText(`${formatDate(firstDay)} – ${formatDate(addDays(firstDay, 29))}`),
    ).toBeInTheDocument();
  });

  it("sells the subscription and shows it in the list", async () => {
    const { user, dialog, api } = await openSellDialog();
    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2));

    await user.selectOptions(within(dialog).getByLabelText("Tariff"), MONTHLY);
    await user.click(within(dialog).getByRole("button", { name: "Sell subscription" }));

    expect(await screen.findByText("Monthly sold to Olena Shevchenko")).toBeInTheDocument();
    expect(
      api.calls("POST", `/api/members/`).find((call) => call.path.endsWith("/subscriptions"))?.body,
    ).toEqual({
      tariffId: MONTHLY,
      startsOn: addDays(today, 20),
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Starts later")).toHaveLength(1);
  });

  it("asks for a tariff before sending", async () => {
    const { user, dialog, api } = await openSellDialog();

    await user.click(within(dialog).getByRole("button", { name: "Sell subscription" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Choose a tariff");
    expect(
      api.calls("POST", "/api/members/").filter((call) => call.path.endsWith("/subscriptions")),
    ).toHaveLength(0);
  });

  it("warns about an overlap and blocks the sale", async () => {
    const { user, dialog, api } = await openSellDialog();
    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(within(dialog).getByLabelText("Tariff"), MONTHLY);

    const input = within(dialog).getByLabelText("First day");
    await user.clear(input);
    await user.type(input, today);

    expect(
      await within(dialog).findByText(/This overlaps the subscription from/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sell subscription" })).toBeDisabled();
    expect(
      api.calls("POST", "/api/members/").filter((call) => call.path.endsWith("/subscriptions")),
    ).toHaveLength(0);
  });

  it("refuses a first day in the past", async () => {
    const { user, dialog } = await openSellDialog();
    const input = within(dialog).getByLabelText("First day");

    await user.clear(input);
    await user.type(input, addDays(today, -1));
    await user.click(within(dialog).getByRole("button", { name: "Sell subscription" }));

    expect(
      await within(dialog).findByText("The first day cannot be in the past"),
    ).toBeInTheDocument();
  });

  it("shows the server's reason when the sale is refused", async () => {
    const { user, dialog } = await openSellDialog(baseMember(), {
      overrides: {
        "POST /api/members/:id/subscriptions": () =>
          problem(400, "An archived tariff can no longer be sold"),
      },
    });
    await waitFor(() => expect(within(dialog).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(within(dialog).getByLabelText("Tariff"), MONTHLY);

    await user.click(within(dialog).getByRole("button", { name: "Sell subscription" }));

    expect(
      await within(dialog).findByText("An archived tariff can no longer be sold"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("starts today for a member without a running subscription", async () => {
    const { dialog } = await openSellDialog(baseMember({ subscriptions: [] }));

    expect(within(dialog).getByLabelText("First day")).toHaveValue(today);
  });

  it("is also offered from the empty state", async () => {
    const state = baseMember({ subscriptions: [] });
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    await user.click(await screen.findByRole("button", { name: "Sell subscription" }));

    expect(await screen.findByRole("dialog", { name: "Sell a subscription" })).toBeInTheDocument();
  });
});

describe("cancelling a subscription", () => {
  it("only offers cancelling for subscriptions that are running or upcoming", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state);

    const rows = await screen.findAllByRole("row", { name: /Monthly|Quarterly/ });
    expect(
      within(rows[0] as HTMLElement).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("asks first, then marks the subscription as cancelled", async () => {
    const state = baseMember();
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    await user.click(
      within((await screen.findAllByRole("row", { name: /Monthly/ }))[0] as HTMLElement).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: "Cancel Monthly subscription?",
    });
    expect(within(confirm).getByText(/Nothing is refunded automatically/)).toBeInTheDocument();
    expect(
      api.calls("POST", "/api/members/").filter((call) => call.path.endsWith("/cancel")),
    ).toHaveLength(0);

    await user.click(within(confirm).getByRole("button", { name: "Cancel subscription" }));

    expect(await screen.findByText("Subscription cancelled")).toBeInTheDocument();
    expect(
      api
        .calls("POST", `/api/members/`)
        .find((call) => call.path.endsWith(`/subscriptions/${ACTIVE_SUB}/cancel`)),
    ).toBeDefined();
    expect(await screen.findByText("Cancelled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });

  it("leaves the subscription alone when you keep it", async () => {
    const state = baseMember();
    const api = profileApi(state);
    const { user } = await openProfile(api, state);

    await user.click(
      within((await screen.findAllByRole("row", { name: /Monthly/ }))[0] as HTMLElement).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep it" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(
      api.calls("POST", "/api/members/").filter((call) => call.path.endsWith("/cancel")),
    ).toHaveLength(0);
  });

  it("explains why cancelling failed and keeps the dialog open", async () => {
    const state = baseMember();
    const api = profileApi(state, {
      overrides: {
        "POST /api/members/:id/subscriptions/:subscriptionId/cancel": () =>
          problem(400, "Subscription has already ended"),
      },
    });
    const { user } = await openProfile(api, state);

    await user.click(
      within((await screen.findAllByRole("row", { name: /Monthly/ }))[0] as HTMLElement).getByRole(
        "button",
        { name: "Cancel" },
      ),
    );
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Cancel subscription" }));

    expect(await within(confirm).findByText("Subscription has already ended")).toBeInTheDocument();
  });
});

describe("tariff names", () => {
  it("shows the tariff of an archived subscription", async () => {
    const state = baseMember();
    await openProfile(profileApi(state), state);

    expect(await screen.findByRole("row", { name: /Quarterly/ })).toBeInTheDocument();
    expect(QUARTERLY).toBeDefined();
  });
});
