import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

interface Tariff {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  visitLimit: number | null;
  archived: boolean;
  version: number;
}

const monthly: Tariff = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0001",
  name: "Monthly",
  priceCents: 4900,
  durationDays: 30,
  visitLimit: null,
  archived: false,
  version: 1,
};
const tenVisits: Tariff = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0002",
  name: "Ten visits",
  priceCents: 3500,
  durationDays: 60,
  visitLimit: 10,
  archived: false,
  version: 1,
};
const retired: Tariff = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0003",
  name: "Retired offer",
  priceCents: 2000,
  durationDays: 14,
  visitLimit: null,
  archived: true,
  version: 2,
};

function tariffApi(initial: Tariff[], overrides: Parameters<typeof mockApi>[0] = {}) {
  const tariffs = initial.map((tariff) => ({ ...tariff }));
  return mockApi({
    "GET /api/tariffs": ({ query }) => ({
      body: tariffs.filter((tariff) => query.get("includeArchived") === "true" || !tariff.archived),
    }),
    "POST /api/tariffs": ({ body }) => {
      const created = {
        id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b01${tariffs.length}0`,
        archived: false,
        version: 1,
        ...(body as object),
      } as Tariff;
      tariffs.push(created);
      return { status: 201, body: created };
    },
    "PATCH /api/tariffs/:id": ({ params, body }) => {
      const target = tariffs.find((tariff) => tariff.id === params.id) as Tariff;
      Object.assign(target, body, { version: target.version + 1 });
      return { body: target };
    },
    "POST /api/tariffs/:id/archive": ({ params }) => {
      const target = tariffs.find((tariff) => tariff.id === params.id) as Tariff;
      target.archived = true;
      target.version += 1;
      return { body: target };
    },
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  renderApp({ path: "/tariffs", roles: ["admin"], fetch: api, ...rest });
  await screen.findByRole("heading", { name: "Tariffs" });
  return user;
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("tariff list", () => {
  it("shows price, validity and visits and hides archived tariffs by default", async () => {
    await openPage({ api: tariffApi([monthly, tenVisits, retired]) });

    const monthlyRow = await screen.findByRole("row", { name: /Monthly/ });
    expect(within(monthlyRow).getByText(/49\.00/)).toBeInTheDocument();
    expect(within(monthlyRow).getByText("30 days")).toBeInTheDocument();
    expect(within(monthlyRow).getByText("Unlimited")).toBeInTheDocument();
    expect(within(row("Ten visits")).getByText("10 visits")).toBeInTheDocument();
    expect(screen.queryByText("Retired offer")).not.toBeInTheDocument();
  });

  it("shows archived tariffs when asked to", async () => {
    const user = await openPage({ api: tariffApi([monthly, retired]) });
    await screen.findByText("Monthly");

    await user.click(screen.getByRole("switch", { name: "Show archived" }));

    const archivedRow = await screen.findByRole("row", { name: /Retired offer/ });
    expect(within(archivedRow).getByText("Archived")).toBeInTheDocument();
    expect(within(archivedRow).queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets only admins change tariffs", async () => {
    await openPage({ roles: ["reception"], api: tariffApi([monthly]) });
    await screen.findByText("Monthly");

    expect(screen.queryByRole("button", { name: "New tariff" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });

  it("invites an admin to create the first tariff", async () => {
    await openPage({ api: tariffApi([]) });

    expect(await screen.findByRole("heading", { name: "No tariffs yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "New tariff" })).toHaveLength(2);
  });

  it("tells reception to ask an admin when there are no tariffs", async () => {
    await openPage({ roles: ["reception"], api: tariffApi([]) });

    expect(await screen.findByText(/An admin has not added any tariffs yet/)).toBeInTheDocument();
  });

  it("explains a loading failure and recovers on retry", async () => {
    let failing = true;
    const api = tariffApi([monthly], {
      "GET /api/tariffs": () =>
        failing ? problem(503, "The database is restarting") : json([monthly]),
    });
    const user = await openPage({ api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Monthly")).toBeInTheDocument();
  });
});

describe("creating a tariff", () => {
  it("sends the tariff in cents and shows it in the list", async () => {
    const api = tariffApi([monthly]);
    const user = await openPage({ api });
    await screen.findByText("Monthly");

    await user.click(screen.getByRole("button", { name: "New tariff" }));
    const dialog = await screen.findByRole("dialog", { name: "New tariff" });
    await user.type(within(dialog).getByLabelText("Name"), "Quarterly");
    await user.type(within(dialog).getByLabelText("Price"), "129.90");
    await user.clear(within(dialog).getByLabelText("Valid for (days)"));
    await user.type(within(dialog).getByLabelText("Valid for (days)"), "90");
    await user.click(within(dialog).getByRole("button", { name: "Create tariff" }));

    expect(await screen.findByText("Quarterly created")).toBeInTheDocument();
    expect(api.calls("POST", "/api/tariffs")[0]?.body).toEqual({
      name: "Quarterly",
      priceCents: 12990,
      durationDays: 90,
      visitLimit: null,
    });
    expect(await screen.findByRole("row", { name: /Quarterly/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("explains what is wrong before sending anything", async () => {
    const api = tariffApi([monthly]);
    const user = await openPage({ api });
    await user.click(await screen.findByRole("button", { name: "New tariff" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Create tariff" }));

    expect(
      await within(dialog).findByText("Enter a name of at least 2 characters"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a price like 49 or 49.90")).toBeInTheDocument();
    expect(api.calls("POST", "/api/tariffs")).toHaveLength(0);
  });

  it("shows a server-side field error next to the field", async () => {
    const api = tariffApi([monthly], {
      "POST /api/tariffs": () =>
        problem(400, "Request validation failed", [
          { path: "priceCents", message: "Price is too high for this club" },
        ]),
    });
    const user = await openPage({ api });
    await user.click(await screen.findByRole("button", { name: "New tariff" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Gold");
    await user.type(within(dialog).getByLabelText("Price"), "999999");
    await user.click(within(dialog).getByRole("button", { name: "Create tariff" }));

    expect(await within(dialog).findByText("Price is too high for this club")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("editing a tariff", () => {
  it("prefills the form and saves with the version it was opened at", async () => {
    const api = tariffApi([monthly]);
    const user = await openPage({ api });
    await screen.findByText("Monthly");

    await user.click(within(row("Monthly")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Monthly" });
    expect(within(dialog).getByLabelText("Price")).toHaveValue("49.00");

    await user.clear(within(dialog).getByLabelText("Price"));
    await user.type(within(dialog).getByLabelText("Price"), "55");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Monthly updated")).toBeInTheDocument();
    expect(api.calls("PATCH", "/api/tariffs/")[0]?.body).toMatchObject({
      priceCents: 5500,
      version: 1,
    });
    expect(
      await within(await screen.findByRole("row", { name: /Monthly/ })).findByText(/55\.00/),
    ).toBeInTheDocument();
  });

  it("shows the conflict message when someone else changed the tariff", async () => {
    const api = tariffApi([monthly], {
      "PATCH /api/tariffs/:id": () =>
        problem(409, "The tariff was changed by someone else, reload and try again"),
    });
    const user = await openPage({ api });
    await screen.findByText("Monthly");
    await user.click(within(row("Monthly")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(
      await within(dialog).findByText(
        "The tariff was changed by someone else, reload and try again",
      ),
    ).toBeInTheDocument();
  });
});

describe("archiving a tariff", () => {
  it("asks first, then removes it from the list", async () => {
    const api = tariffApi([monthly, tenVisits]);
    const user = await openPage({ api });
    await screen.findByText("Ten visits");

    await user.click(within(row("Ten visits")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Archive Ten visits?" });
    expect(api.calls("POST", "/api/tariffs/")).toHaveLength(0);

    await user.click(within(confirm).getByRole("button", { name: "Archive tariff" }));

    expect(await screen.findByText("Ten visits archived")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Ten visits/ })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("row", { name: /Monthly/ })).toBeInTheDocument();
  });

  it("keeps the dialog open and explains a failure", async () => {
    const api = tariffApi([monthly], {
      "POST /api/tariffs/:id/archive": () => problem(409, "The tariff was changed by someone else"),
    });
    const user = await openPage({ api });
    await screen.findByText("Monthly");

    await user.click(within(row("Monthly")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive tariff" }));

    expect(
      await within(confirm).findByText("The tariff was changed by someone else"),
    ).toBeInTheDocument();
  });

  it("leaves everything as it was when cancelled", async () => {
    const api = tariffApi([monthly]);
    const user = await openPage({ api });
    await screen.findByText("Monthly");

    await user.click(within(row("Monthly")).getByRole("button", { name: "Archive" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep it" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(api.calls("POST", "/api/tariffs/")).toHaveLength(0);
  });
});
