interface Slot {
  date: string;
  startTime: string;
  endTime: string;
}

function localDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function localTime(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

export function hasStarted(slot: Slot, now: Date = new Date()): boolean {
  const today = localDate(now);
  return slot.date < today || (slot.date === today && slot.startTime <= localTime(now));
}

export function hasEnded(slot: Slot, now: Date = new Date()): boolean {
  const today = localDate(now);
  return slot.date < today || (slot.date === today && slot.endTime <= localTime(now));
}
