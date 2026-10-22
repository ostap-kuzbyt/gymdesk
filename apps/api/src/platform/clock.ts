export interface Clock {
  now: () => Date;
  today: () => string;
}

export function createClock(timeZone: string, source: () => Date = () => new Date()): Clock {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return { now: source, today: () => formatter.format(source()) };
}
