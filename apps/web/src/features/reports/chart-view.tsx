import { useState } from "react";
import { supportsWebGl } from "@/components/webgl";
import { Button } from "@/components/ui/button";

export type ChartView = "3d" | "flat";

export function useChartView(): [ChartView, (view: ChartView) => void, boolean] {
  const available = supportsWebGl();
  const [view, setView] = useState<ChartView>(available ? "3d" : "flat");
  return [available ? view : "flat", setView, available];
}

export function ChartViewToggle({
  view,
  onChange,
}: {
  view: ChartView;
  onChange: (view: ChartView) => void;
}) {
  return (
    <div role="group" aria-label="Chart style" className="flex gap-2">
      {(["3d", "flat"] as const).map((option) => (
        <Button
          key={option}
          size="sm"
          variant={view === option ? "secondary" : "outline"}
          aria-pressed={view === option}
          onClick={() => onChange(option)}
        >
          {option === "3d" ? "3D" : "Flat"}
        </Button>
      ))}
    </div>
  );
}
