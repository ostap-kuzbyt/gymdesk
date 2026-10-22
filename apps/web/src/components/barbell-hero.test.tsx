import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BarbellHero, supportsWebGl } from "./barbell-hero";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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

describe("BarbellHero", () => {
  it("shows the still plate and a description when WebGL is missing", () => {
    render(<BarbellHero />);

    const hero = screen.getByRole("img", { name: /barbell/i });
    expect(hero.querySelector("svg")).not.toBeNull();
    expect(hero.querySelector("canvas")).toBeNull();
  });
});
