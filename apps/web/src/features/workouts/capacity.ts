import type { PlateTone } from "@/lib/plates";

export interface Fill {
  label: string;
  tone: PlateTone;
}

export function fillOf(reserved: number, capacity: number): Fill {
  const left = Math.max(capacity - reserved, 0);
  if (left === 0) return { label: "Full", tone: "red" };
  const label = left === 1 ? "1 place left" : `${left} places left`;
  return { label, tone: left / capacity <= 0.25 ? "yellow" : "green" };
}
