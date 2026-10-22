import { Suspense, lazy, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PlateMark } from "@/components/plate-mark";
import { SceneBoundary, prefersReducedMotion, supportsWebGl } from "@/components/webgl";
import { cn } from "@/lib/utils";

const LifterScene = lazy(() => import("@/features/scenes/lifter"));

const PUSH = 0.7;
const MAX_ENERGY = 3;

function StaticPlate() {
  return (
    <div className="grid size-full place-items-center">
      <PlateMark className="size-2/5 max-h-48 max-w-48 drop-shadow-xl" />
    </div>
  );
}

export function LifterHero({ className }: { className?: string }) {
  const energy = useRef(0);
  const [reps, setReps] = useState(0);
  const interactive = supportsWebGl();

  const push = () => {
    energy.current = Math.min(MAX_ENERGY, energy.current + PUSH);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      push();
    }
  };

  if (!interactive) {
    return (
      <div
        role="img"
        aria-label="A lifter doing a bench press"
        className={cn("relative size-full min-h-48", className)}
      >
        <StaticPlate />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="A lifter doing a bench press. Click to make him press harder."
      onPointerDown={push}
      onKeyDown={onKeyDown}
      className={cn(
        "relative size-full min-h-48 cursor-pointer rounded-xl outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <SceneBoundary fallback={<StaticPlate />}>
        <Suspense fallback={<StaticPlate />}>
          <LifterScene energy={energy} onRep={setReps} still={prefersReducedMotion()} />
        </Suspense>
      </SceneBoundary>
      <p className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-card/85 px-3 py-1 text-sm font-medium shadow-sm backdrop-blur">
        {reps === 0 ? "Click to push" : `${reps} ${reps === 1 ? "rep" : "reps"}`}
      </p>
    </div>
  );
}
