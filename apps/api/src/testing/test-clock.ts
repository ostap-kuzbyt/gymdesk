import { createClock } from "../platform/clock.js";
import type { Clock } from "../platform/clock.js";

export function fixedClock(isoInstant = "2026-10-21T09:00:00Z"): Clock {
  return createClock("UTC", () => new Date(isoInstant));
}
