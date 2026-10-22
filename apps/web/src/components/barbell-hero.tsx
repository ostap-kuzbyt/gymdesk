import { Component, Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { PlateMark } from "@/components/plate-mark";
import { cn } from "@/lib/utils";

const BarbellScene = lazy(() => import("@/features/scenes/barbell"));

export function supportsWebGl(): boolean {
  if (typeof window === "undefined" || typeof window.WebGLRenderingContext === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function StaticPlate() {
  return (
    <div className="grid size-full place-items-center">
      <PlateMark className="size-2/5 max-h-48 max-w-48 drop-shadow-xl" />
    </div>
  );
}

export function BarbellHero({ className, distance }: { className?: string; distance?: number }) {
  const fallback = <StaticPlate />;

  return (
    <div
      role="img"
      aria-label="A barbell with three coloured weight plates"
      className={cn("relative size-full min-h-48", className)}
    >
      {supportsWebGl() ? (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <BarbellScene
              still={prefersReducedMotion()}
              {...(distance === undefined ? {} : { distance })}
            />
          </Suspense>
        </SceneBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
