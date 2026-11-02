import { describe, expect, it } from "vitest";
import {
  BAR_CRUSH,
  BAR_HIGH,
  BAR_SQUASH,
  GIVE_UP_AFTER,
  BAR_LOW,
  LOCKOUT_SECONDS,
  MAX_ENERGY,
  PUMP_PER_CLICK,
  PUMP_RESET,
  initialSim,
  legAngles,
  phaseFor,
  physique,
  barAt,
  step,
} from "./lifter-sim";
import type { Sim } from "./lifter-sim";

const DT = 1 / 60;

function run(sim: Sim, seconds: number, energy: number): { sim: Sim; reps: number } {
  let current = sim;
  let reps = 0;
  for (let time = 0; time < seconds; time += DT) {
    const result = step(current, DT, energy);
    current = result.sim;
    if (result.repDone) reps += 1;
  }
  return { sim: current, reps };
}

describe("a lifter nobody is cheering", () => {
  it("holds the bar locked out for a moment", () => {
    const { sim } = run(initialSim, LOCKOUT_SECONDS - 0.5, 0);

    expect(sim.mode).toBe("rest");
    expect(sim.barY).toBe(BAR_HIGH);
    expect(sim.struggle).toBe(0);
  });

  it("then lets it sink onto his chest while he starts to flail", () => {
    const sinking = run(initialSim, LOCKOUT_SECONDS + 1.5, 0).sim;

    expect(sinking.mode).toBe("sink");
    expect(sinking.barY).toBeLessThan(BAR_HIGH);
    expect(sinking.struggle).toBeGreaterThan(0.5);

    const pinned = run(sinking, 2, 0).sim;
    expect(pinned.barY).toBe(BAR_CRUSH);
    expect(pinned.struggle).toBeGreaterThan(0.95);
  });
});

describe("a lifter who is left pinned too long", () => {
  const pinnedFor = (seconds: number) => run(initialSim, LOCKOUT_SECONDS + seconds, 0).sim;

  it("keeps fighting for a while", () => {
    const fighting = pinnedFor(GIVE_UP_AFTER - 1);

    expect(fighting.mode).toBe("sink");
    expect(fighting.struggle).toBeGreaterThan(0.9);
    expect(fighting.limp).toBeLessThan(0.05);
  });

  it("gives up, goes limp and lets the bar squash him", () => {
    const beaten = pinnedFor(GIVE_UP_AFTER + 6);

    expect(beaten.mode).toBe("crushed");
    expect(beaten.struggle).toBeLessThan(0.05);
    expect(beaten.limp).toBeGreaterThan(0.95);
    expect(beaten.barY).toBe(BAR_SQUASH);
  });

  it("is rescued by a click and presses the bar back up from where it lay", () => {
    const beaten = pinnedFor(GIVE_UP_AFTER + 6);

    const rescued = step(beaten, DT, 1).sim;
    expect(rescued.mode).toBe("press");

    const later = run(rescued, 3, 1.5).sim;
    expect(later.barY).toBeGreaterThan(BAR_LOW);
    expect(later.limp).toBeLessThan(0.05);
  });

  it("only starts counting the time once the bar is coming down", () => {
    expect(run(initialSim, LOCKOUT_SECONDS - 0.5, 0).sim.sinkFor).toBe(0);
  });
});

describe("pressing", () => {
  it("counts a rep for every full cycle and keeps the bar between the two ends", () => {
    let current = initialSim;
    let reps = 0;
    for (let time = 0; time < 6; time += DT) {
      const result = step(current, DT, 2);
      current = result.sim;
      expect(current.barY).toBeGreaterThanOrEqual(BAR_LOW - 1e-9);
      expect(current.barY).toBeLessThanOrEqual(BAR_HIGH + 1e-9);
      if (result.repDone) reps += 1;
    }

    expect(reps).toBeGreaterThanOrEqual(3);
    expect(current.reps).toBe(reps);
  });

  it("presses faster when there is more energy", () => {
    const calm = run(initialSim, 8, 0.8).reps;
    const frantic = run(initialSim, 8, MAX_ENERGY).reps;

    expect(frantic).toBeGreaterThan(calm);
  });

  it("finishes the rep he is in, then locks out, when the clicking stops", () => {
    const mid = run(initialSim, 1, 2).sim;
    expect(mid.mode).toBe("press");

    const stopped = run(mid, 3, 0).sim;
    expect(stopped.mode).toBe("rest");
    expect(stopped.barY).toBe(BAR_HIGH);
  });

  it("heaves a bar that is pinned back up from where it was", () => {
    const pinned = run(initialSim, LOCKOUT_SECONDS + 4, 0).sim;
    expect(pinned.barY).toBe(BAR_CRUSH);

    const resumed = step(pinned, DT, 1).sim;

    expect(resumed.mode).toBe("press");
    expect(resumed.barY).toBeLessThan(BAR_LOW + 0.1);

    const later = run(resumed, 1, 1).sim;
    expect(later.barY).toBeGreaterThan(resumed.barY);
  });
});

describe("pump", () => {
  it("grows with every click and caps at full", () => {
    let current = initialSim;
    const seen: number[] = [];
    for (let click = 0; click < 20; click++) {
      current = step(current, DT, 2, PUMP_PER_CLICK).sim;
      seen.push(current.pump);
    }

    expect(seen[0]).toBeCloseTo(PUMP_PER_CLICK);
    expect(seen[4]).toBeGreaterThan(seen[0] as number);
    expect(seen.at(-1)).toBe(1);
  });

  it("does not grow on its own, however hard he is pressing", () => {
    expect(run(initialSim, 10, MAX_ENERGY).sim.pump).toBe(0);
  });

  it("reports the moment he reaches full pump once", () => {
    let current: Sim = { ...initialSim, pump: 1 - PUMP_PER_CLICK / 2 };

    const reaching = step(current, DT, 2, PUMP_PER_CLICK);
    expect(reaching.maxed).toBe(true);
    current = reaching.sim;

    expect(step(current, DT, 2, PUMP_PER_CLICK).maxed).toBe(false);
  });

  it("can be knocked back after the show and then builds again", () => {
    const full: Sim = { ...initialSim, pump: 1 };

    const deflated = step(full, DT, 0, 0, PUMP_RESET).sim;
    expect(deflated.pump).toBeCloseTo(PUMP_RESET, 1);

    let current = deflated;
    let maxed = false;
    for (let click = 0; click < 12 && !maxed; click++) {
      const result = step(current, DT, 2, PUMP_PER_CLICK);
      current = result.sim;
      maxed = result.maxed;
    }
    expect(maxed).toBe(true);
  });

  it("shrinks slowly once the clicking stops and never goes below zero", () => {
    const pumped: Sim = { ...initialSim, pump: 1 };
    const later = run(pumped, 10, 0).sim.pump;

    expect(later).toBeLessThan(1);
    expect(later).toBeGreaterThan(0.5);
    expect(run(pumped, 80, 0).sim.pump).toBe(0);
  });

  it("holds its size while he is still pressing between clicks", () => {
    const pumped: Sim = { ...initialSim, pump: 0.6 };

    expect(run(pumped, 2, 1.5).sim.pump).toBe(0.6);
  });
});

describe("bar and phase helpers", () => {
  it("maps the phase to the bar height and back", () => {
    expect(barAt(0)).toBeCloseTo(BAR_HIGH);
    expect(barAt(Math.PI)).toBeCloseTo(BAR_LOW);
    expect(barAt(phaseFor(1.5))).toBeCloseTo(1.5);
  });
});

describe("physique", () => {
  it("makes him a skinny guy with no pump and a huge one with full pump", () => {
    const skinny = physique(0);
    const jacked = physique(1);

    expect(jacked.arms / skinny.arms).toBeGreaterThan(2.4);
    expect(jacked.chest / skinny.chest).toBeGreaterThan(1.7);
    expect(jacked.shoulders / skinny.shoulders).toBeGreaterThan(2.4);
    expect(jacked.thighs / skinny.thighs).toBeGreaterThan(1.9);
    expect(skinny.arms).toBeLessThan(0.8);
  });

  it("grows steadily and never shrinks while the pump rises", () => {
    let previous = physique(0);
    for (let pump = 0.1; pump <= 1.0001; pump += 0.1) {
      const current = physique(pump);
      for (const key of Object.keys(current) as (keyof typeof current)[]) {
        expect(current[key]).toBeGreaterThan(previous[key]);
      }
      previous = current;
    }
  });

  it("ignores values outside the range", () => {
    expect(physique(-3)).toEqual(physique(0));
    expect(physique(5)).toEqual(physique(1));
  });
});

describe("legAngles", () => {
  const times = Array.from({ length: 400 }, (_, index) => index * 0.025);

  it("keeps the legs in their resting pose when he is not struggling", () => {
    for (const side of [1, -1] as const) {
      const rest = legAngles(side, 3.3, 0, 0);
      expect(rest.thigh).toBeCloseTo(0.2);
      expect(rest.shin).toBeCloseTo(-1.4);
    }
  });

  it("only ever kicks forward, never back under the bench", () => {
    for (const side of [1, -1] as const) {
      for (const time of times) {
        const { thigh, shin } = legAngles(side, time, 1, 0);

        expect(Math.cos(thigh)).toBeGreaterThan(0.7);
        expect(Math.cos(shin)).toBeGreaterThan(0);
        expect(thigh).toBeGreaterThanOrEqual(0.2 - 1e-9);
        expect(thigh).toBeLessThanOrEqual(0.7 + 1e-9);
        expect(shin).toBeGreaterThanOrEqual(-1.4 - 1e-9);
        expect(shin).toBeLessThanOrEqual(-0.45 + 1e-9);
      }
    }
  });

  it("really does move, and the two legs alternate", () => {
    const left = times.map((time) => legAngles(1, time, 1, 0).shin);
    const right = times.map((time) => legAngles(-1, time, 1, 0).shin);

    expect(Math.max(...left) - Math.min(...left)).toBeGreaterThan(0.8);
    const sameTime = times.findIndex((_, index) => left[index] === Math.max(...left));
    expect(right[sameTime]).toBeLessThan((left[sameTime] as number) - 0.5);
  });

  it("hangs limp towards the floor once he has given up", () => {
    const { thigh, shin } = legAngles(1, 5, 0, 1);

    expect(thigh).toBeCloseTo(-0.55);
    expect(shin).toBeCloseTo(-1.5);
  });
});
