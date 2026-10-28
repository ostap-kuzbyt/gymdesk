import { describe, expect, it } from "vitest";
import { fillOf } from "./capacity";

describe("fillOf", () => {
  it("is green while there is plenty of room", () => {
    expect(fillOf(3, 20)).toEqual({ label: "17 places left", tone: "green" });
  });

  it("turns yellow when a quarter or less is left", () => {
    expect(fillOf(15, 20)).toEqual({ label: "5 places left", tone: "yellow" });
    expect(fillOf(14, 20)).toMatchObject({ tone: "green" });
  });

  it("says one place left in the singular and red when full", () => {
    expect(fillOf(9, 10)).toEqual({ label: "1 place left", tone: "yellow" });
    expect(fillOf(10, 10)).toEqual({ label: "Full", tone: "red" });
    expect(fillOf(12, 10)).toEqual({ label: "Full", tone: "red" });
  });

  it("keeps a private session green until it is booked", () => {
    expect(fillOf(0, 1)).toEqual({ label: "1 place left", tone: "green" });
    expect(fillOf(1, 1)).toEqual({ label: "Full", tone: "red" });
  });
});
