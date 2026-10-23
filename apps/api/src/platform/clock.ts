export interface Moment {
  date: string;
  time: string;
  iso: string;
}

export interface Clock {
  now: () => Date;
  today: () => string;
  moment: () => Moment;
}

export function createClock(timeZone: string, source: () => Date = () => new Date()): Clock {
  const dateFormat = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return {
    now: source,
    today: () => dateFormat.format(source()),
    moment: () => {
      const instant = source();
      return {
        date: dateFormat.format(instant),
        time: timeFormat.format(instant),
        iso: instant.toISOString(),
      };
    },
  };
}
