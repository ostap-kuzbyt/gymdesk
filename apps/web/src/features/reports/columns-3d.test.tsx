import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartViewToggle, useChartView } from "./chart-view";
import { Columns3D } from "./columns-3d";

const scene = vi.hoisted(() => ({
  onHover: null as ((index: number | null) => void) | null,
  columns: [] as { label: string; value: number; ghost?: number }[],
}));

vi.mock("@/features/scenes/columns", () => ({
  default: ({
    columns,
    onHover,
  }: {
    columns: { label: string; value: number; ghost?: number }[];
    onHover: (index: number | null) => void;
  }) => {
    scene.columns = columns;
    scene.onHover = onHover;
    return <div data-testid="scene" />;
  },
}));

function stubWebGl() {
  vi.stubGlobal("WebGLRenderingContext", class {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  scene.onHover = null;
  scene.columns = [];
});

function Harness() {
  const [view, setView, available] = useChartView();
  return (
    <div>
      <p>{`view:${view} available:${String(available)}`}</p>
      {available ? <ChartViewToggle view={view} onChange={setView} /> : null}
    </div>
  );
}

describe("useChartView", () => {
  it("stays flat and offers no toggle without WebGL", () => {
    render(<Harness />);

    expect(screen.getByText("view:flat available:false")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Chart style" })).not.toBeInTheDocument();
  });

  describe("with WebGL", () => {
    beforeEach(stubWebGl);

    it("starts in 3D and lets the user switch to the flat chart and back", async () => {
      const user = userEvent.setup();
      render(<Harness />);

      expect(screen.getByText("view:3d available:true")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "3D" })).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "Flat" }));
      expect(screen.getByText("view:flat available:true")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Flat" })).toHaveAttribute("aria-pressed", "true");

      await user.click(screen.getByRole("button", { name: "3D" }));
      expect(screen.getByText("view:3d available:true")).toBeInTheDocument();
    });
  });
});

describe("Columns3D", () => {
  beforeEach(stubWebGl);

  const columns = [
    { label: "Sep 2026", value: 100, caption: "Sep 2026: UAH 100.00" },
    { label: "Oct 2026", value: 250, ghost: 300, caption: "Oct 2026: UAH 250.00" },
  ];

  it("describes the chart and hands the data to the scene", async () => {
    render(<Columns3D columns={columns} label="Revenue by month" />);

    expect(await screen.findByTestId("scene")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Revenue by month" })).toBeInTheDocument();
    expect(scene.columns.map((item) => item.value)).toEqual([100, 250]);
    expect(scene.columns[1]?.ghost).toBe(300);
  });

  it("explains how to use it, then shows the value of the column under the pointer", async () => {
    render(<Columns3D columns={columns} label="Revenue by month" />);
    await screen.findByTestId("scene");

    expect(screen.getByText(/Drag to rotate/)).toBeInTheDocument();

    act(() => scene.onHover?.(1));
    expect(screen.getByText("Oct 2026: UAH 250.00")).toBeInTheDocument();

    act(() => scene.onHover?.(null));
    expect(screen.getByText(/Drag to rotate/)).toBeInTheDocument();
  });
});
