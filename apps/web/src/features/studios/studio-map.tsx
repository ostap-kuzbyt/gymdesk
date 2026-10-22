import { Link, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useMemo, useState } from "react";
import { SceneBoundary, prefersReducedMotion, supportsWebGl } from "@/components/webgl";
import { useWorkouts } from "@/features/workouts/api";
import { todayLocal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useStudios } from "./api";
import { studioLoads } from "./load";

const StudioMapScene = lazy(() => import("@/features/scenes/studio-map"));

const BAR_TONES = {
  green: "bg-plate-green",
  yellow: "bg-plate-yellow",
  red: "bg-plate-red",
  blue: "bg-plate-blue",
  neutral: "bg-muted-foreground",
} as const;

export function StudioMap() {
  const today = todayLocal();
  const studios = useStudios(false);
  const workouts = useWorkouts({ from: today, to: today });
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);

  const loads = useMemo(
    () => studioLoads(studios.data ?? [], workouts.data ?? []),
    [studios.data, workouts.data],
  );

  if (loads.length === 0) return null;

  const openStudio = (studioId: string) =>
    void navigate({
      to: "/schedule",
      search: { week: undefined, studio: studioId, coach: undefined },
    });

  return (
    <section className="surface grid overflow-hidden lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {supportsWebGl() ? (
        <div
          role="img"
          aria-label="A 3D map of the studios where taller blocks are fuller rooms"
          className="h-72 bg-gradient-to-br from-card via-plate-blue-soft to-plate-green-soft lg:h-auto lg:min-h-80"
        >
          <SceneBoundary fallback={null}>
            <Suspense fallback={null}>
              <StudioMapScene
                studios={loads}
                activeId={active}
                still={prefersReducedMotion()}
                onHover={setActive}
                onSelect={openStudio}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h2>Studios today</h2>
          <p className="text-sm text-muted-foreground">
            Taller blocks are fuller rooms. Select one to open its schedule.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {loads.map((load) => (
            <li key={load.id}>
              <Link
                to="/schedule"
                search={{ week: undefined, studio: load.id, coach: undefined }}
                onMouseEnter={() => setActive(load.id)}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "block rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-accent focus-visible:outline-2",
                  active === load.id && "border-primary bg-accent",
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{load.name}</span>
                  <span className="text-sm text-muted-foreground">{load.summary}</span>
                </span>
                <span className="mt-2 block h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", BAR_TONES[load.tone])}
                    style={{ width: `${Math.round(load.ratio * 100)}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
