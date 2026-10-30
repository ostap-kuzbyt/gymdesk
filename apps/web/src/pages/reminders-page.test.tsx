import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { json, mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

interface Reminder {
  id: string;
  memberId: string;
  memberName: string;
  subscriptionId: string | null;
  kind: "expiry" | "promo";
  trigger: "scan" | "manual";
  email: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

function reminder(index: number, overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(1000 + index)}`,
    memberId: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b${String(2000 + index)}`,
    memberName: `Member ${String(index).padStart(2, "0")}`,
    subscriptionId: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b3001",
    kind: "expiry",
    trigger: "scan",
    email: `member${index}@example.com`,
    status: "sent",
    attempts: 1,
    error: null,
    createdAt: new Date(2026, 9, 21, 8, 0).toISOString(),
    sentAt: new Date(2026, 9, 21, 8, 0, 3).toISOString(),
    ...overrides,
  };
}

function remindersApi(all: Reminder[], overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    "GET /api/reminders": ({ query }) => {
      const status = query.get("status");
      const kind = query.get("kind");
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 25);
      const matching = all.filter(
        (item) => (!status || item.status === status) && (!kind || item.kind === kind),
      );
      return json({ items: matching.slice(offset, offset + limit), total: matching.length });
    },
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  const view = renderApp({ path: "/reminders", roles: ["reception"], fetch: api, ...rest });
  await screen.findByRole("heading", { name: "Reminders" });
  return { user, ...view };
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("reminder list", () => {
  it("shows who got what, how and when, with failures explained", async () => {
    const api = remindersApi([
      reminder(1),
      reminder(2, { kind: "promo", trigger: "manual", subscriptionId: null }),
      reminder(3, {
        status: "failed",
        attempts: 2,
        error: "SendGrid responded with 401",
        sentAt: null,
      }),
    ]);
    await openPage({ api });

    const first = await screen.findByRole("row", { name: /Member 01/ });
    expect(within(first).getByText("Expiry reminder")).toBeInTheDocument();
    expect(within(first).getByText("Automatic")).toBeInTheDocument();
    expect(within(first).getByText("Sent")).toBeInTheDocument();
    expect(within(first).getByText("21 Oct 2026, 08:00")).toBeInTheDocument();
    expect(within(first).queryByRole("button")).not.toBeInTheDocument();

    const second = row("Member 02");
    expect(within(second).getByText("Promotion")).toBeInTheDocument();
    expect(within(second).getByText("Sent by hand")).toBeInTheDocument();

    const failed = row("Member 03");
    expect(within(failed).getByText("Failed")).toBeInTheDocument();
    expect(within(failed).getByText("SendGrid responded with 401")).toBeInTheDocument();
    expect(within(failed).getByText("2 attempts")).toBeInTheDocument();
    expect(within(failed).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("explains an empty inbox and an empty filter", async () => {
    await openPage({ api: remindersApi([]) });
    expect(await screen.findByRole("heading", { name: "No reminders yet" })).toBeInTheDocument();
    expect(screen.getByText(/go out automatically every morning/)).toBeInTheDocument();
  });

  it("explains a loading failure and retries", async () => {
    let failing = true;
    const api = remindersApi([reminder(1)], {
      "GET /api/reminders": () =>
        failing
          ? problem(503, "The database is restarting")
          : json({ items: [reminder(1)], total: 1 }),
    });
    const { user } = await openPage({ api });

    expect(await screen.findByText("The database is restarting")).toBeInTheDocument();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Member 01")).toBeInTheDocument();
  });

  it("is hidden from coaches", async () => {
    renderApp({ path: "/reminders", roles: ["coach"], fetch: remindersApi([]) });

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
  });
});

describe("filters and pages", () => {
  const all = [
    reminder(1),
    reminder(2, { status: "failed", error: "boom", sentAt: null }),
    reminder(3, { kind: "promo", trigger: "manual", subscriptionId: null }),
  ];

  it("filters by status and sends the filter to the server", async () => {
    const api = remindersApi(all);
    const { user, router } = await openPage({ api });
    await screen.findByText("Member 01");

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "failed");

    await waitFor(() => expect(screen.queryByText("Member 01")).not.toBeInTheDocument());
    expect(screen.getByText("Member 02")).toBeInTheDocument();
    expect(api.urls("GET").some((url) => url.includes("status=failed"))).toBe(true);
    expect(router.state.location.search).toMatchObject({ status: "failed" });
  });

  it("filters by type and says when nothing matches", async () => {
    const api = remindersApi([reminder(1)]);
    const { user } = await openPage({ api });
    await screen.findByText("Member 01");

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "promo");

    expect(await screen.findByRole("heading", { name: "No reminders match" })).toBeInTheDocument();
  });

  it("starts from the filter in the address", async () => {
    const api = remindersApi(all);
    renderApp({ path: "/reminders?status=failed", roles: ["reception"], fetch: api });

    expect(await screen.findByText("Member 02")).toBeInTheDocument();
    expect(screen.queryByText("Member 01")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("failed"),
    );
  });

  it("pages through a long list", async () => {
    const many = Array.from({ length: 30 }, (_, index) => reminder(index + 1));
    const { user } = await openPage({ api: remindersApi(many) });

    expect(await screen.findByText("1–25 of 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("26–30 of 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("retrying", () => {
  const failed = reminder(3, { status: "failed", error: "mailbox full", sentAt: null });

  it("retries a failed reminder and confirms when it goes through", async () => {
    const api = remindersApi([failed], {
      "POST /api/reminders/:id/retry": () =>
        json({ ...failed, status: "sent", attempts: 2, error: null }),
    });
    const { user } = await openPage({ api });

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Reminder sent to Member 03")).toBeInTheDocument();
    expect(api.calls("POST", `/api/reminders/${failed.id}/retry`)).toHaveLength(1);
  });

  it("says when the retry failed again", async () => {
    const api = remindersApi([failed], {
      "POST /api/reminders/:id/retry": () => json({ ...failed, attempts: 2, error: "still down" }),
    });
    const { user } = await openPage({ api });

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Reminder to Member 03 failed again")).toBeInTheDocument();
    expect(screen.getAllByText("still down").length).toBeGreaterThan(0);
  });

  it("explains why a retry was refused", async () => {
    const api = remindersApi([failed], {
      "POST /api/reminders/:id/retry": () =>
        problem(400, "The subscription is no longer active, so there is nothing to remind about"),
    });
    const { user } = await openPage({ api });

    await user.click(await screen.findByRole("button", { name: "Retry" }));

    expect(await screen.findByText(/nothing to remind about/)).toBeInTheDocument();
  });
});

describe("expiry scan", () => {
  it("is offered to admins and reports what it did", async () => {
    const api = remindersApi([], {
      "POST /api/reminders/scan": () =>
        json({ date: "2026-10-21", considered: 5, sent: 3, failed: 1, skipped: 1 }),
    });
    const { user } = await openPage({ roles: ["admin"], api });

    await user.click(screen.getByRole("button", { name: "Run expiry scan" }));

    expect(await screen.findByText("Expiry scan finished")).toBeInTheDocument();
    expect(screen.getByText("3 sent, 1 failed, 1 skipped")).toBeInTheDocument();
  });

  it("is not offered to reception", async () => {
    await openPage({ api: remindersApi([]) });

    expect(screen.queryByRole("button", { name: "Run expiry scan" })).not.toBeInTheDocument();
  });
});

describe("sending by hand", () => {
  const OLENA = {
    id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b9001",
    fullName: "Olena Shevchenko",
    age: 32,
    email: "olena@example.com",
    phone: null,
    activeUntil: null,
  };

  function sendApi(overrides: Parameters<typeof mockApi>[0] = {}) {
    return remindersApi([], {
      "GET /api/members": () => json({ items: [OLENA], total: 1 }),
      "POST /api/members/:id/reminders": ({ body }) =>
        json(
          {
            ...reminder(9, { memberName: "Olena Shevchenko", email: "olena@example.com" }),
            kind: (body as { kind: "expiry" | "promo" }).kind,
            trigger: "manual",
          },
          201,
        ),
      ...overrides,
    });
  }

  async function openDialog(api: ReturnType<typeof mockApi>) {
    const view = await openPage({ api });
    await view.user.click(
      screen.getAllByRole("button", { name: "Send a reminder" })[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Send a reminder" });
    return { ...view, dialog };
  }

  it("finds the member, sends the chosen kind and confirms", async () => {
    const api = sendApi();
    const { user, dialog } = await openDialog(api);
    expect(within(dialog).getByRole("button", { name: "Send reminder" })).toBeDisabled();

    await user.type(within(dialog).getByRole("searchbox", { name: "Find a member" }), "olena");
    await user.click(
      await within(dialog).findByRole("button", { name: "Choose Olena Shevchenko" }),
    );
    await user.click(within(dialog).getByRole("radio", { name: /Promotion/ }));
    await user.click(within(dialog).getByRole("button", { name: "Send reminder" }));

    expect(await screen.findByText("Reminder sent to Olena Shevchenko")).toBeInTheDocument();
    expect(api.calls("POST", `/api/members/${OLENA.id}/reminders`)[0]?.body).toEqual({
      kind: "promo",
    });
  });

  it("starts with the expiry reminder selected", async () => {
    const { dialog } = await openDialog(sendApi());

    expect(within(dialog).getByRole("radio", { name: /Expiry reminder/ })).toBeChecked();
  });

  it("lets you pick a different member after choosing one", async () => {
    const { user, dialog } = await openDialog(sendApi());
    await user.type(within(dialog).getByRole("searchbox", { name: "Find a member" }), "olena");
    await user.click(
      await within(dialog).findByRole("button", { name: "Choose Olena Shevchenko" }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Change" }));

    expect(within(dialog).getByRole("searchbox", { name: "Find a member" })).toBeInTheDocument();
  });

  it("shows the reason when the server refuses", async () => {
    const api = sendApi({
      "POST /api/members/:id/reminders": () =>
        problem(400, "The member has no active subscription to remind about"),
    });
    const { user, dialog } = await openDialog(api);
    await user.type(within(dialog).getByRole("searchbox", { name: "Find a member" }), "olena");
    await user.click(
      await within(dialog).findByRole("button", { name: "Choose Olena Shevchenko" }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Send reminder" }));

    expect(
      await within(dialog).findByText(/no active subscription to remind about/),
    ).toBeInTheDocument();
  });

  it("warns when the mail service could not deliver", async () => {
    const api = sendApi({
      "POST /api/members/:id/reminders": () =>
        json(
          {
            ...reminder(9, { memberName: "Olena Shevchenko" }),
            status: "failed",
            error: "mailbox full",
            sentAt: null,
          },
          201,
        ),
    });
    const { user, dialog } = await openDialog(api);
    await user.type(within(dialog).getByRole("searchbox", { name: "Find a member" }), "olena");
    await user.click(
      await within(dialog).findByRole("button", { name: "Choose Olena Shevchenko" }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Send reminder" }));

    expect(
      await screen.findByText("Reminder to Olena Shevchenko was not delivered"),
    ).toBeInTheDocument();
    expect(screen.getByText("mailbox full")).toBeInTheDocument();
  });
});
