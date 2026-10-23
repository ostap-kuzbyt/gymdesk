import { describe, expect, it } from "vitest";
import { createClock } from "./clock.js";

const lateEveningUtc = () => new Date("2026-10-20T22:30:00Z");

describe("createClock", () => {
  it("reports the calendar day in the club's time zone", () => {
    expect(createClock("Europe/Kyiv", lateEveningUtc).today()).toBe("2026-10-21");
    expect(createClock("UTC", lateEveningUtc).today()).toBe("2026-10-20");
    expect(createClock("America/New_York", lateEveningUtc).today()).toBe("2026-10-20");
  });

  it("formats the day with zero padding", () => {
    const clock = createClock("UTC", () => new Date("2026-03-04T10:00:00Z"));

    expect(clock.today()).toBe("2026-03-04");
  });

  it("exposes the instant from the same source", () => {
    expect(createClock("UTC", lateEveningUtc).now().toISOString()).toBe("2026-10-20T22:30:00.000Z");
  });

  it("reports the local time of day and a full moment", () => {
    const kyiv = createClock("Europe/Kyiv", lateEveningUtc);

    expect(kyiv.moment()).toEqual({
      date: "2026-10-21",
      time: "01:30",
      iso: "2026-10-20T22:30:00.000Z",
    });
  });

  it("never shows 24:00 at local midnight", () => {
    const clock = createClock("UTC", () => new Date("2026-10-21T00:05:00Z"));

    expect(clock.moment().time).toBe("00:05");
  });
});
