export const TAU = Math.PI * 2;
export const BAR_LOW = 1.1;
export const BAR_HIGH = 1.82;
export const BAR_CRUSH = 1.04;
export const BAR_SQUASH = 0.97;
export const SQUASH_SPEED = 0.15;
export const GIVE_UP_AFTER = 6;
export const MAX_ENERGY = 3;
export const ENERGY_FLOOR = 0.02;
export const LOCKOUT_SECONDS = 2.5;
export const SINK_SPEED = 0.28;
export const PUMP_PER_CLICK = 0.07;
export const PUMP_LOSS = 0.03;
export const PUMP_RESET = 0.45;

export type Mode = "rest" | "press" | "sink" | "crushed";
export type Mood = "idle" | "stuck" | "crushed";

export function moodOf(mode: Mode): Mood {
  if (mode === "sink") return "stuck";
  return mode === "crushed" ? "crushed" : "idle";
}

export interface Controls {
  energy: number;
  boost: number;
  resetPump: number | null;
}

export function newControls(): Controls {
  return { energy: 0, boost: 0, resetPump: null };
}

export interface Sim {
  mode: Mode;
  phase: number;
  barY: number;
  idleFor: number;
  sinkFor: number;
  reps: number;
  pump: number;
  struggle: number;
  limp: number;
}

export const initialSim: Sim = {
  mode: "rest",
  phase: 0,
  barY: BAR_HIGH,
  idleFor: 0,
  sinkFor: 0,
  reps: 0,
  pump: 0,
  struggle: 0,
  limp: 0,
};

export interface StepResult {
  sim: Sim;
  repDone: boolean;
  maxed: boolean;
}

export function barAt(phase: number): number {
  return BAR_LOW + ((1 + Math.cos(phase)) / 2) * (BAR_HIGH - BAR_LOW);
}

export function phaseFor(barY: number): number {
  const lift = Math.min(Math.max((barY - BAR_LOW) / (BAR_HIGH - BAR_LOW), 0), 1);
  return TAU - Math.acos(2 * lift - 1);
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

export function step(
  previous: Sim,
  dt: number,
  energy: number,
  boost = 0,
  resetPump: number | null = null,
): StepResult {
  const sim = { ...previous };
  if (resetPump !== null) sim.pump = resetPump;
  const pressing = energy > ENERGY_FLOOR;
  let repDone = false;

  if (pressing) {
    if (sim.mode === "sink" || sim.mode === "crushed") sim.phase = phaseFor(sim.barY);
    if (sim.mode === "rest") sim.phase = 0;
    sim.mode = "press";
    sim.idleFor = 0;
    sim.sinkFor = 0;
  }

  if (sim.mode === "press") {
    sim.phase += (pressing ? 1.8 + energy * 1.6 : 2.4) * dt;
    if (sim.phase >= TAU) {
      sim.reps += 1;
      repDone = true;
      if (pressing) {
        sim.phase -= TAU;
      } else {
        sim.phase = 0;
        sim.mode = "rest";
        sim.idleFor = 0;
      }
    }
    sim.barY = barAt(sim.phase);
  } else if (sim.mode === "rest") {
    sim.barY = BAR_HIGH;
    sim.idleFor += dt;
    if (sim.idleFor >= LOCKOUT_SECONDS) {
      sim.mode = "sink";
      sim.sinkFor = 0;
    }
  } else if (sim.mode === "sink") {
    sim.barY = Math.max(BAR_CRUSH, sim.barY - SINK_SPEED * dt);
    sim.sinkFor += dt;
    if (sim.sinkFor >= GIVE_UP_AFTER) sim.mode = "crushed";
  } else {
    sim.barY = Math.max(BAR_SQUASH, sim.barY - SQUASH_SPEED * dt);
  }

  const struggleTarget = sim.mode === "sink" ? clamp((BAR_HIGH - sim.barY) / 0.25, 0, 1) : 0;
  sim.struggle += (struggleTarget - sim.struggle) * Math.min(1, 3 * dt);
  sim.limp += ((sim.mode === "crushed" ? 1 : 0) - sim.limp) * Math.min(1, 2.5 * dt);

  const pumpBefore = sim.pump;
  sim.pump = Math.min(1, sim.pump + boost);
  if (boost === 0 && !pressing) sim.pump = Math.max(0, sim.pump - PUMP_LOSS * dt);

  return { sim, repDone, maxed: pumpBefore < 1 && sim.pump >= 1 };
}

export interface Physique {
  arms: number;
  hands: number;
  shoulders: number;
  chest: number;
  waist: number;
  thighs: number;
  shins: number;
}

export function physique(pump: number): Physique {
  const p = Math.min(Math.max(pump, 0), 1);
  const arms = 0.72 + 1.2 * p;
  return {
    arms,
    hands: 0.8 + 0.25 * p,
    shoulders: arms * 1.08,
    chest: 0.8 + 0.7 * p,
    waist: 0.88 + 0.22 * p,
    thighs: 0.78 + 0.75 * p,
    shins: 0.85 + 0.45 * p,
  };
}

export interface LegAngles {
  thigh: number;
  shin: number;
}

export function legAngles(side: 1 | -1, time: number, struggle: number, limp: number): LegAngles {
  const offset = side > 0 ? 0 : Math.PI;
  const kneeLift = ((1 + Math.sin(time * 11 + offset)) / 2) * struggle;
  const kick = ((1 + Math.sin(time * 11 + offset - 1)) / 2) * struggle;

  return {
    thigh: (0.2 + 0.5 * kneeLift) * (1 - limp) - 0.55 * limp,
    shin: (-1.4 + 0.95 * kick) * (1 - limp) - 1.5 * limp,
  };
}
