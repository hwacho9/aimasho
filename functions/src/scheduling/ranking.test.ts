import { describe, expect, it } from "vitest";
import { rankSchedule } from "./ranking.js";

describe("rankSchedule", () => {
  it("prioritizes fewer NO votes before score", () => {
    const result = rankSchedule(
      [
        { id: "a", startDateTime: "2026-08-21T19:00:00+09:00" },
        { id: "b", startDateTime: "2026-08-22T19:00:00+09:00" },
      ],
      [
        { participantUid: "u1", slotId: "a", status: "YES" },
        { participantUid: "u2", slotId: "a", status: "YES" },
        { participantUid: "u3", slotId: "a", status: "NO" },
        { participantUid: "u1", slotId: "b", status: "YES" },
        { participantUid: "u2", slotId: "b", status: "MAYBE" },
        { participantUid: "u3", slotId: "b", status: "YES" },
      ],
      3,
    );
    expect(result.recommended?.id).toBe("b");
    expect(result.recommended).toMatchObject({ yes: 2, maybe: 1, no: 0, totalScore: 5 });
  });

  it("uses the earlier date as the final tie breaker", () => {
    const result = rankSchedule(
      [
        { id: "late", startDateTime: "2026-08-22T19:00:00+09:00" },
        { id: "early", startDateTime: "2026-08-21T19:00:00+09:00" },
      ],
      [],
      0,
    );
    expect(result.recommended?.id).toBe("early");
  });
});
