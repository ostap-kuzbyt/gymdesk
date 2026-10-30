import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ids } from "@/test/fixtures";
import { renderApp } from "@/test/render-app";

describe("what a coach sees", () => {
  it("has no coach filter on the schedule, unlike the front desk", async () => {
    renderApp({ path: "/schedule", roles: ["coach"] });
    await screen.findByRole("heading", { name: "Schedule" });
    expect(screen.queryByRole("combobox", { name: "Coach" })).not.toBeInTheDocument();
  });

  it("keeps the coach filter for reception", async () => {
    renderApp({ path: "/schedule", roles: ["reception"] });
    expect(await screen.findByRole("combobox", { name: "Coach" })).toBeInTheDocument();
  });

  it("describes the member list as their own", async () => {
    renderApp({ path: "/members", roles: ["coach"] });
    expect(await screen.findByText("The members assigned to you.")).toBeInTheDocument();
  });

  it("shows the assigned members on their own coach page", async () => {
    renderApp({ path: `/coaches/${ids.coachIvan}`, roles: ["coach"] });
    expect(await screen.findByRole("heading", { name: "Members" })).toBeInTheDocument();
  });

  it("explains instead of failing on another coach's page", async () => {
    renderApp({ path: `/coaches/${ids.coachOlha}`, roles: ["coach"] });

    expect(await screen.findByText(/Only the front desk and this coach/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Members" })).not.toBeInTheDocument();
  });
});
