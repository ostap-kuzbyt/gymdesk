import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
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
