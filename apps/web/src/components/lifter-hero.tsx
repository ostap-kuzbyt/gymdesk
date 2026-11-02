import { Suspense, lazy, useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { PlateMark } from "@/components/plate-mark";
import { GigachadGif } from "@/components/gigachad-gif";
import { SceneBoundary, prefersReducedMotion, supportsWebGl } from "@/components/webgl";
import { PUMP_PER_CLICK, PUMP_RESET, newControls } from "@/features/scenes/lifter-sim";
import type { Mood } from "@/features/scenes/lifter-sim";
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

function hintFor(reps: number, mood: Mood): string {
  if (mood === "crushed") return "He gave up! Click to save him";
  if (mood === "stuck") return "He's stuck! Click to help";
  if (reps === 0) return "Click to push";
  return `${reps} ${reps === 1 ? "rep" : "reps"}`;
}

export function LifterHero({ className }: { className?: string }) {
  const controls = useRef(newControls());
  const [reps, setReps] = useState(0);
  const [mood, setMood] = useState<Mood>("idle");
  const [gif, setGif] = useState(false);
  const interactive = supportsWebGl();

  const push = () => {
    controls.current.energy = Math.min(MAX_ENERGY, controls.current.energy + PUSH);
    controls.current.boost += PUMP_PER_CLICK;
  };

  const closeGif = useCallback(() => {
    setGif(false);
    controls.current.resetPump = PUMP_RESET;
  }, []);

  const onMax = () => setGif(true);

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
      <div className="size-full">
        <SceneBoundary fallback={<StaticPlate />}>
          <Suspense fallback={<StaticPlate />}>
            <LifterScene
              controls={controls}
              onRep={setReps}
              onMood={setMood}
              onMax={onMax}
              still={prefersReducedMotion()}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      {gif ? <GigachadGif onFinished={closeGif} /> : null}
      <p
        className={cn(
          "pointer-events-none absolute right-3 bottom-3 rounded-full bg-card/85 px-3 py-1 text-sm font-medium shadow-sm backdrop-blur",
          mood !== "idle" && "bg-plate-red-soft text-plate-red",
        )}
      >
        {hintFor(reps, mood)}
      </p>
    </div>
  );
}
