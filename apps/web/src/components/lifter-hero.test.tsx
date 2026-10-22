import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifterHero } from "./lifter-hero";
import { supportsWebGl } from "./webgl";

const scene = vi.hoisted(() => ({
  energy: null as MutableRefObject<number> | null,
  onRep: null as ((reps: number) => void) | null,
}));

vi.mock("@/features/scenes/lifter", () => ({
  default: ({
    energy,
    onRep,
  }: {
    energy: MutableRefObject<number>;
    onRep: (reps: number) => void;
  }) => {
    scene.energy = energy;
    scene.onRep = onRep;
    return <div data-testid="scene" />;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  scene.energy = null;
  scene.onRep = null;
});

describe("supportsWebGl", () => {
  it("is false where the browser has no WebGL", () => {
    expect(supportsWebGl()).toBe(false);
  });

  it("is true when a context can be created", () => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);

    expect(supportsWebGl()).toBe(true);
  });

  it("is false when creating a context fails", () => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(supportsWebGl()).toBe(false);
  });
});

describe("LifterHero without WebGL", () => {
  it("shows a still plate with a description and nothing to click", () => {
    render(<LifterHero />);

    const hero = screen.getByRole("img", { name: /bench press/i });
    expect(hero.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("LifterHero with WebGL", () => {
  beforeEach(() => {
    vi.stubGlobal("WebGLRenderingContext", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
  });

  it("invites a click before the first rep", async () => {
    render(<LifterHero />);

    expect(await screen.findByTestId("scene")).toBeInTheDocument();
    expect(screen.getByText("Click to push")).toBeInTheDocument();
  });

  it("gives the lifter more energy with every click, up to a limit", async () => {
    const user = userEvent.setup();
    render(<LifterHero />);
    await screen.findByTestId("scene");
    const button = screen.getByRole("button", { name: /bench press/i });

    await user.click(button);
    const afterOne = scene.energy?.current ?? 0;
    await user.click(button);
    const afterTwo = scene.energy?.current ?? 0;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterTwo).toBeGreaterThan(afterOne);

    for (let index = 0; index < 10; index++) await user.click(button);
    expect(scene.energy?.current).toBe(3);
  });

  it("can be pushed from the keyboard", async () => {
    const user = userEvent.setup();
    render(<LifterHero />);
    await screen.findByTestId("scene");

    screen.getByRole("button", { name: /bench press/i }).focus();
    await user.keyboard("{Enter}");

    expect(scene.energy?.current).toBeGreaterThan(0);
  });

  it("counts the reps the scene reports", async () => {
    render(<LifterHero />);
    await screen.findByTestId("scene");

    act(() => scene.onRep?.(1));
    expect(screen.getByText("1 rep")).toBeInTheDocument();

    act(() => scene.onRep?.(7));
    expect(screen.getByText("7 reps")).toBeInTheDocument();
  });
});
