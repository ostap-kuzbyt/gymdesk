import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, problem } from "@/test/mock-api";
import { renderApp } from "@/test/render-app";
import type { RenderOptions } from "@/test/render-app";

interface Studio {
  id: string;
  name: string;
  capacity: number;
  archived: boolean;
  version: number;
}

const mainHall: Studio = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1001",
  name: "Main hall",
  capacity: 30,
  archived: false,
  version: 1,
};
const yoga: Studio = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1002",
  name: "Yoga room",
  capacity: 14,
  archived: false,
  version: 1,
};
const sauna: Studio = {
  id: "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b1003",
  name: "Old sauna",
  capacity: 1,
  archived: true,
  version: 3,
};

function studioApi(initial: Studio[], overrides: Parameters<typeof mockApi>[0] = {}) {
  const studios = initial.map((studio) => ({ ...studio }));
  return mockApi({
    "GET /api/studios": ({ query }) => ({
      body: studios.filter((studio) => query.get("includeArchived") === "true" || !studio.archived),
    }),
    "POST /api/studios": ({ body }) => {
      const created = {
        id: `6f1d7a52-2f0f-4a43-9a53-5d9b1a9b11${studios.length}0`,
        archived: false,
        version: 1,
        ...(body as object),
      } as Studio;
      studios.push(created);
      return { status: 201, body: created };
    },
    "PATCH /api/studios/:id": ({ params, body }) => {
      const target = studios.find((studio) => studio.id === params.id) as Studio;
      Object.assign(target, body, { version: target.version + 1 });
      return { body: target };
    },
    "POST /api/studios/:id/archive": ({ params }) => {
      const target = studios.find((studio) => studio.id === params.id) as Studio;
      target.archived = true;
      return { body: target };
    },
    ...overrides,
  });
}

async function openPage(options: RenderOptions & { api: ReturnType<typeof mockApi> }) {
  const { api, ...rest } = options;
  const user = userEvent.setup();
  renderApp({ path: "/studios", roles: ["admin"], fetch: api, ...rest });
  await screen.findByRole("heading", { name: "Studios" });
  return user;
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(name) });

describe("studio list", () => {
  it("shows the capacity of each studio and hides archived ones by default", async () => {
    await openPage({ api: studioApi([mainHall, yoga, sauna]) });

    expect(
      within(await screen.findByRole("row", { name: /Main hall/ })).getByText("30 people"),
    ).toBeInTheDocument();
    expect(within(row("Yoga room")).getByText("14 people")).toBeInTheDocument();
    expect(screen.queryByText("Old sauna")).not.toBeInTheDocument();
  });

  it("shows archived studios on request, with a single-person wording", async () => {
    const user = await openPage({ api: studioApi([mainHall, sauna]) });
    await screen.findByText("Main hall");

    await user.click(screen.getByRole("switch", { name: "Show archived" }));

    const archivedRow = await screen.findByRole("row", { name: /Old sauna/ });
    expect(within(archivedRow).getByText("Archived")).toBeInTheDocument();
    expect(within(archivedRow).getByText("1 person")).toBeInTheDocument();
  });

  it("lets only admins change studios", async () => {
    await openPage({ roles: ["coach"], api: studioApi([mainHall]) });
    await screen.findByText("Main hall");

    expect(screen.queryByRole("button", { name: "New studio" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("invites an admin to add the first studio", async () => {
    await openPage({ api: studioApi([]) });

    expect(await screen.findByRole("heading", { name: "No studios yet" })).toBeInTheDocument();
  });

  it("explains a loading failure", async () => {
    const api = studioApi([], {
      "GET /api/studios": () => problem(500, "Something broke on the server"),
    });
    await openPage({ api });

    expect(await screen.findByText("Something broke on the server")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("creating and editing", () => {
  it("creates a studio and shows it", async () => {
    const api = studioApi([mainHall]);
    const user = await openPage({ api });
    await screen.findByText("Main hall");

    await user.click(screen.getByRole("button", { name: "New studio" }));
    const dialog = await screen.findByRole("dialog", { name: "New studio" });
    await user.type(within(dialog).getByLabelText("Name"), "Cycling studio");
    await user.type(within(dialog).getByLabelText("Capacity"), "18");
    await user.click(within(dialog).getByRole("button", { name: "Create studio" }));

    expect(await screen.findByText("Cycling studio created")).toBeInTheDocument();
    expect(api.calls("POST", "/api/studios")[0]?.body).toEqual({
      name: "Cycling studio",
      capacity: 18,
    });
    expect(await screen.findByRole("row", { name: /Cycling studio/ })).toBeInTheDocument();
  });

  it("validates before sending", async () => {
    const api = studioApi([]);
    const user = await openPage({ api });
    await user.click(
      (await screen.findAllByRole("button", { name: "New studio" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Capacity"), "900");
    await user.click(within(dialog).getByRole("button", { name: "Create studio" }));

    expect(
      await within(dialog).findByText("Enter a name of at least 2 characters"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Use between 1 and 500 people")).toBeInTheDocument();
    expect(api.calls("POST", "/api/studios")).toHaveLength(0);
  });

  it("edits with the version it was opened at and shows a name conflict from the server", async () => {
    const api = studioApi([mainHall], {
      "PATCH /api/studios/:id": () =>
        problem(400, "Request validation failed", [
          { path: "name", message: "That name is already used" },
        ]),
    });
    const user = await openPage({ api });
    await screen.findByText("Main hall");

    await user.click(within(row("Main hall")).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Main hall" });
    expect(within(dialog).getByLabelText("Capacity")).toHaveValue("30");
    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "Yoga room");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await within(dialog).findByText("That name is already used")).toBeInTheDocument();
    expect(api.calls("PATCH", "/api/studios/")[0]?.body).toMatchObject({
      name: "Yoga room",
      version: 1,
    });
  });
});

describe("archiving", () => {
  it("asks first and then removes the studio from the list", async () => {
    const api = studioApi([mainHall, yoga]);
    const user = await openPage({ api });
    await screen.findByText("Yoga room");

    await user.click(within(row("Yoga room")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Archive Yoga room?" });
    await user.click(within(confirm).getByRole("button", { name: "Archive studio" }));

    expect(await screen.findByText("Yoga room archived")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("row", { name: /Yoga room/ })).not.toBeInTheDocument(),
    );
  });

  it("explains why archiving failed", async () => {
    const api = studioApi([mainHall], {
      "POST /api/studios/:id/archive": () => problem(409, "The studio was changed by someone else"),
    });
    const user = await openPage({ api });
    await screen.findByText("Main hall");

    await user.click(within(row("Main hall")).getByRole("button", { name: "Archive" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Archive studio" }));

    expect(
      await within(confirm).findByText("The studio was changed by someone else"),
    ).toBeInTheDocument();
  });
});
