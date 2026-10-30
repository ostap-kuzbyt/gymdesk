import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/msw/server";
import { renderApp } from "@/test/render-app";

const pagesNav = () => screen.getAllByRole("navigation", { name: "Pages" })[0] as HTMLElement;

describe("top bar", () => {
  it("shows an admin every main tab and the club menu", async () => {
    renderApp({ roles: ["admin"] });

    await screen.findByRole("heading", { name: "Today" });
    const tabs = within(pagesNav())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(tabs).toEqual(["Today", "Check-in", "Members", "Schedule", "Reminders", "Reports"]);
    expect(within(pagesNav()).getByRole("button", { name: "Club" })).toBeInTheDocument();
  });

  it("hides reminders and reports from a coach", async () => {
    renderApp({ roles: ["coach"] });

    await screen.findByRole("heading", { name: "Today" });
    const tabs = within(pagesNav())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(tabs).toEqual(["Today", "Members", "Schedule"]);
  });

  it("marks the tab of the current page", async () => {
    renderApp({ roles: ["reception"], path: "/members" });

    await screen.findByRole("heading", { name: "Members" });
    expect(within(pagesNav()).getByRole("link", { name: "Members" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(pagesNav()).getByRole("link", { name: "Today" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("lists tariffs, studios and coaches in the club menu", async () => {
    const user = userEvent.setup();
    renderApp({ roles: ["admin"] });
    await screen.findByRole("heading", { name: "Today" });

    await user.click(within(pagesNav()).getByRole("button", { name: "Club" }));

    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Tariffs", "Studios", "Coaches"]);

    await user.click(within(menu).getByRole("menuitem", { name: "Studios" }));
    expect(await screen.findByRole("heading", { name: "Studios" })).toBeInTheDocument();
  });

  it("shows the account and signs out", async () => {
    const user = userEvent.setup();
    const { session } = renderApp({ roles: ["reception", "coach"] });
    await screen.findByRole("heading", { name: "Today" });

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(await screen.findByText("iryna@club.test")).toBeInTheDocument();
    expect(screen.getByText("Reception, Coach")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(session.signOut).toHaveBeenCalledOnce();
  });

  it("opens the same pages from the menu button on small screens", async () => {
    const user = userEvent.setup();
    renderApp({ roles: ["coach"] });
    await screen.findByRole("heading", { name: "Today" });

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    const dialog = await screen.findByRole("dialog");
    const links = within(dialog)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(links).toEqual(["Today", "Members", "Schedule", "Tariffs", "Studios", "Coaches"]);
  });
});

describe("page access", () => {
  it("explains why a coach cannot open reports", async () => {
    renderApp({ roles: ["coach"], path: "/reports" });

    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
    expect(screen.getByText(/Your account has Coach/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reports" })).not.toBeInTheDocument();
  });

  it("lets the front desk open reports", async () => {
    renderApp({ roles: ["reception"], path: "/reports" });

    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
  });

  it("shows a not found page with a way back", async () => {
    renderApp({ path: "/does-not-exist" });

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/");
  });
});

describe("coach account link", () => {
  const meAs = (roles: string[], coachId: string | null) =>
    server.use(
      http.get("/api/me", () => HttpResponse.json({ subject: "auth0|coach-777", roles, coachId })),
    );

  it("tells a coach whose account has no profile which id to hand to an admin", async () => {
    meAs(["coach"], null);
    renderApp({ roles: ["coach"] });

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("not linked to a coach profile");
    expect(within(notice).getByText("auth0|coach-777")).toBeInTheDocument();
  });

  it("stays quiet once the account is linked", async () => {
    meAs(["coach"], "6f1d7a52-2f0f-4a43-9a53-5d9b1a9b0001");
    renderApp({ roles: ["coach"] });

    await screen.findByRole("heading", { name: "Today" });
    expect(screen.queryByText(/not linked to a coach profile/)).not.toBeInTheDocument();
  });

  it("does not look the account up for front desk roles", async () => {
    let asked = false;
    server.use(
      http.get("/api/me", () => {
        asked = true;
        return HttpResponse.json({ subject: "x", roles: ["admin"], coachId: null });
      }),
    );
    renderApp({ roles: ["admin"] });

    await screen.findByRole("heading", { name: "Today" });
    expect(asked).toBe(false);
    expect(screen.queryByText(/not linked to a coach profile/)).not.toBeInTheDocument();
  });
});
