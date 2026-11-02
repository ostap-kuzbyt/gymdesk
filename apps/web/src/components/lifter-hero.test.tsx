import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUMP_PER_CLICK, PUMP_RESET } from "@/features/scenes/lifter-sim";
import type { Controls, Mood } from "@/features/scenes/lifter-sim";
import { GIGACHAD_GIF_MS, GIGACHAD_GIF_URL } from "./gigachad-gif";
import { LifterHero } from "./lifter-hero";
import { supportsWebGl } from "./webgl";

const scene = vi.hoisted(() => ({
  controls: null as MutableRefObject<Controls> | null,
  onRep: null as ((reps: number) => void) | null,
  onMood: null as ((mood: Mood) => void) | null,
  onMax: null as (() => void) | null,
}));

vi.mock("@/features/scenes/lifter", () => ({
  default: ({
    controls,
    onRep,
    onMood,
    onMax,
  }: {
    controls: MutableRefObject<Controls>;
    onRep: (reps: number) => void;
    onMood: (mood: Mood) => void;
    onMax: () => void;
  }) => {
    scene.controls = controls;
    scene.onRep = onRep;
    scene.onMood = onMood;
    scene.onMax = onMax;
    return <div data-testid="scene" />;
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  scene.controls = null;
  scene.onRep = null;
  scene.onMood = null;
  scene.onMax = null;
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

  const gigachad = () => screen.queryByRole("dialog", { name: "Gigachad" });

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
    const afterOne = scene.controls?.current.energy ?? 0;
    await user.click(button);
    const afterTwo = scene.controls?.current.energy ?? 0;

    expect(afterOne).toBeGreaterThan(0);
    expect(afterTwo).toBeGreaterThan(afterOne);

    for (let index = 0; index < 10; index++) await user.click(button);
    expect(scene.controls?.current.energy).toBe(3);
  });

  it("adds a little pump with every click for the scene to pick up", async () => {
    const user = userEvent.setup();
    render(<LifterHero />);
    await screen.findByTestId("scene");
    const button = screen.getByRole("button", { name: /bench press/i });

    await user.click(button);
    await user.click(button);
    await user.click(button);

    expect(scene.controls?.current.boost).toBeCloseTo(PUMP_PER_CLICK * 3);
  });

  it("can be pushed from the keyboard", async () => {
    const user = userEvent.setup();
    render(<LifterHero />);
    await screen.findByTestId("scene");

    screen.getByRole("button", { name: /bench press/i }).focus();
    await user.keyboard("{Enter}");

    expect(scene.controls?.current.energy).toBeGreaterThan(0);
    expect(scene.controls?.current.boost).toBeGreaterThan(0);
  });

  it("counts the reps the scene reports", async () => {
    render(<LifterHero />);
    await screen.findByTestId("scene");

    act(() => scene.onRep?.(1));
    expect(screen.getByText("1 rep")).toBeInTheDocument();

    act(() => scene.onRep?.(7));
    expect(screen.getByText("7 reps")).toBeInTheDocument();
  });

  it("asks for help while he is pinned under the bar", async () => {
    render(<LifterHero />);
    await screen.findByTestId("scene");

    act(() => scene.onMood?.("stuck"));
    expect(screen.getByText("He's stuck! Click to help")).toBeInTheDocument();

    act(() => scene.onMood?.("crushed"));
    expect(screen.getByText("He gave up! Click to save him")).toBeInTheDocument();

    act(() => scene.onMood?.("idle"));
    expect(screen.getByText("Click to push")).toBeInTheDocument();
  });

  describe("when he is pumped to the maximum", () => {
    it("shows no gif before that, however much he is clicked", async () => {
      render(<LifterHero />);
      await screen.findByTestId("scene");

      const button = screen.getByRole("button", { name: /bench press/i });
      for (let index = 0; index < 30; index++) fireEvent.pointerDown(button);

      expect(gigachad()).not.toBeInTheDocument();
    });

    it("covers the whole screen with the gif", async () => {
      render(<LifterHero />);
      await screen.findByTestId("scene");

      act(() => scene.onMax?.());

      const dialog = gigachad() as HTMLElement;
      expect(dialog.className).toContain("fixed");
      expect(dialog.className).toContain("inset-0");
      expect(dialog.parentElement).toBe(document.body);
      expect(screen.getByRole("img", { name: "Gigachad" })).toHaveAttribute(
        "src",
        GIGACHAD_GIF_URL,
      );
    });

    it("stays until the gif has played once, then takes it away and deflates him a bit", async () => {
      vi.useFakeTimers();
      render(<LifterHero />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => scene.onMax?.());
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(gigachad()).toBeInTheDocument();

      fireEvent.load(screen.getByRole("img", { name: "Gigachad" }));
      act(() => {
        vi.advanceTimersByTime(GIGACHAD_GIF_MS - 100);
      });
      expect(gigachad()).toBeInTheDocument();
      expect(scene.controls?.current.resetPump).toBeNull();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(gigachad()).not.toBeInTheDocument();
      expect(scene.controls?.current.resetPump).toBe(PUMP_RESET);
    });

    it("cannot be dismissed early with a click or Escape", async () => {
      const user = userEvent.setup();
      render(<LifterHero />);
      await screen.findByTestId("scene");

      act(() => scene.onMax?.());
      fireEvent.load(screen.getByRole("img", { name: "Gigachad" }));

      await user.click(gigachad() as HTMLElement);
      await user.keyboard("{Escape}");

      expect(gigachad()).toBeInTheDocument();
    });

    it("gives up on a gif that cannot be loaded", async () => {
      render(<LifterHero />);
      await screen.findByTestId("scene");

      act(() => scene.onMax?.());
      fireEvent.error(screen.getByRole("img", { name: "Gigachad" }));

      expect(gigachad()).not.toBeInTheDocument();
      expect(scene.controls?.current.resetPump).toBe(PUMP_RESET);
    });

    it("does not wait forever for a gif that never arrives", async () => {
      vi.useFakeTimers();
      render(<LifterHero />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      act(() => scene.onMax?.());
      act(() => {
        vi.advanceTimersByTime(14000);
      });
      expect(gigachad()).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(gigachad()).not.toBeInTheDocument();
    });
  });
});
