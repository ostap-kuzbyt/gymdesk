import { Suspense, lazy, useState } from "react";
import { SceneBoundary, prefersReducedMotion } from "@/components/webgl";
import type { ColumnItem } from "@/features/scenes/columns";

const ColumnsScene = lazy(() => import("@/features/scenes/columns"));

export interface Column3D extends ColumnItem {
  caption: string;
}

export function Columns3D({
  columns,
  label,
  color = "#3b82ff",
}: {
  columns: Column3D[];
  label: string;
  color?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const shown = active === null ? undefined : columns[active];

  return (
    <figure
      role="img"
      aria-label={label}
      className="surface relative h-80 overflow-hidden bg-gradient-to-br from-card via-plate-blue-soft to-plate-green-soft"
    >
      <SceneBoundary fallback={null}>
        <Suspense fallback={null}>
          <ColumnsScene
            columns={columns}
            color={color}
            activeIndex={active}
            still={prefersReducedMotion()}
            onHover={setActive}
          />
        </Suspense>
      </SceneBoundary>
      <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-card/85 px-3 py-1 text-sm font-medium shadow-sm backdrop-blur">
        {shown ? shown.caption : "Drag to rotate, point at a column for its value"}
      </p>
    </figure>
  );
}
