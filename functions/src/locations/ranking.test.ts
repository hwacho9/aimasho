import { describe, expect, it } from "vitest";
import { geographicCenter, rankMeetingPoints } from "./ranking.js";

describe("meeting point ranking", () => {
  const locations = [
    { placeId: "a", name: "A", latitude: 35, longitude: 139 },
    { placeId: "b", name: "B", latitude: 36, longitude: 140 },
  ];

  it("computes the geographic center", () => {
    expect(geographicCenter(locations)).toEqual({ latitude: 35.5, longitude: 139.5 });
  });

  it("FAIR prefers lower variance while FAST prefers lower average", () => {
    const durations = [[15, 31], [15, 31], [60, 31]];
    const fair = rankMeetingPoints(locations, durations, ["u1", "u2", "u3"], "FAIR");
    const fast = rankMeetingPoints(locations, durations, ["u1", "u2", "u3"], "FAST");
    expect(fair[0]?.name).toBe("B");
    expect(fast[0]?.name).toBe("A");
  });
});
