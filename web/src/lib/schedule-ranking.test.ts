import { describe, expect, it } from "vitest";
import { rankSchedule } from "./schedule-ranking";

describe("rankSchedule", () => {
  it("prefers fewer unavailable participants before total score", () => {
    const slots = [
      { id: "popular", startDateTime: "2026-09-02T10:00:00.000Z" },
      { id: "available", startDateTime: "2026-09-01T10:00:00.000Z" },
    ];
    const votes = [
      { participantUid: "a", slotId: "popular", status: "YES" as const },
      { participantUid: "b", slotId: "popular", status: "YES" as const },
      { participantUid: "c", slotId: "popular", status: "NO" as const },
      { participantUid: "a", slotId: "available", status: "MAYBE" as const },
      { participantUid: "b", slotId: "available", status: "MAYBE" as const },
    ];

    const result = rankSchedule(slots, votes, 3);

    expect(result.recommended?.id).toBe("available");
    expect(result.ranking[0]).toMatchObject({ yes: 0, maybe: 2, no: 0, totalScore: 2, participantCount: 3 });
  });

  it("uses the earlier slot as the final tie breaker", () => {
    const result = rankSchedule([
      { id: "later", startDateTime: "2026-09-02T10:00:00.000Z" },
      { id: "earlier", startDateTime: "2026-09-01T10:00:00.000Z" },
    ], [], 2);

    expect(result.ranking.map((slot) => slot.id)).toEqual(["earlier", "later"]);
  });
});
