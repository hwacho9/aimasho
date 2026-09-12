import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  requireContentVoteConfig,
  requireExpensePayload,
  requireLocation,
  requireScheduleCondition,
  responseDeadlineHasPassed,
} from "./domain-validation.js";

describe("domain callable validation", () => {
  it("normalizes schedule ranges and weekday filters", () => {
    expect(requireScheduleCondition({
      mode: "RANGE",
      rangeStart: "2026-09-01T00:00:00+09:00",
      rangeEnd: "2026-09-30T23:59:00+09:00",
      weekdayNumbers: [6, 0, 6],
    })).toEqual({
      mode: "RANGE",
      rangeStart: "2026-08-31T15:00:00.000Z",
      rangeEnd: "2026-09-30T14:59:00.000Z",
      weekdayNumbers: [0, 6],
    });
  });

  it("applies content voting defaults", () => {
    expect(requireContentVoteConfig({ food: true })).toEqual({
      food: true,
      activity: false,
      allowMultiple: false,
      allowParticipantOptions: true,
    });
  });

  it("validates locations and trims public fields", () => {
    expect(requireLocation({
      placeId: " place-1 ",
      name: " 横浜駅 ",
      address: "Kanagawa",
      latitude: 35.465981,
      longitude: 139.62234,
    })).toMatchObject({ placeId: "place-1", name: "横浜駅" });
    expect(() => requireLocation({
      placeId: "bad",
      name: "bad",
      latitude: 200,
      longitude: 139,
    })).toThrow("coordinates are invalid");
  });

  it("deduplicates expense participants", () => {
    expect(requireExpensePayload({
      title: " dinner ",
      amount: 5000,
      paidByUid: "host",
      participantUids: ["host", "friend", "host"],
    })).toEqual({
      title: "dinner",
      amount: 5000,
      paidByUid: "host",
      participantUids: ["host", "friend"],
    });
  });

  it("checks deadlines against an injected clock", () => {
    const now = Date.parse("2026-09-01T00:00:00.000Z");
    expect(responseDeadlineHasPassed(Timestamp.fromMillis(now - 1), now)).toBe(true);
    expect(responseDeadlineHasPassed(Timestamp.fromMillis(now + 1), now)).toBe(false);
  });
});
