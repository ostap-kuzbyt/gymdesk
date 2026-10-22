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
});
