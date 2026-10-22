import { describe, expect, it } from "vitest";
import { studioLoads } from "./load";

const hall = { id: "s1", name: "Main hall", archived: false };
const yoga = { id: "s2", name: "Yoga room", archived: false };

const workout = (studioId: string, reserved: number, capacity: number, cancelled = false) => ({
  studioId,
  reserved,
  capacity,
  cancelled,
});

describe("studioLoads", () => {
  it("adds up the places booked and offered in each studio", () => {
    const [main] = studioLoads([hall], [workout("s1", 6, 10), workout("s1", 4, 10)]);

    expect(main).toMatchObject({
      workouts: 2,
      reserved: 10,
      capacity: 20,
      ratio: 0.5,
      tone: "green",
      summary: "10 of 20 places booked",
    });
  });

  it("marks a nearly full studio yellow and a full one red", () => {
    const loads = studioLoads([hall, yoga], [workout("s1", 8, 10), workout("s2", 10, 10)]);

    expect(loads.map((load) => load.tone)).toEqual(["yellow", "red"]);
  });

  it("shows a studio without workouts as flat and neutral", () => {
    const [main] = studioLoads([hall], []);

    expect(main).toMatchObject({ ratio: 0, tone: "neutral", summary: "No workouts today" });
  });

  it("ignores cancelled workouts and archived studios, and sorts by name", () => {
    const archived = { id: "s3", name: "Old gym", archived: true };
    const loads = studioLoads([yoga, archived, hall], [workout("s1", 5, 10, true)]);

    expect(loads.map((load) => load.name)).toEqual(["Main hall", "Yoga room"]);
    expect(loads[0]).toMatchObject({ workouts: 0, ratio: 0 });
  });
});
