import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  historyDate,
  mapPlaceVisits,
  travelTimelineStops,
  timestampIso,
  type HistoryMeetupPayload,
} from "./history.js";

const place = {
  placeId: "places/yokohama",
  name: "横浜駅",
  latitude: 35.465981,
  longitude: 139.62234,
};

function meetup(
  id: string,
  status: HistoryMeetupPayload["status"],
): HistoryMeetupPayload {
  return {
    id,
    title: id,
    status,
    confirmedDateTime: null,
    completedAt: null,
    meetingPlace: place,
    planPlaces: [],
    candidateDateTimes: [],
    roomId: null,
  };
}

describe("dashboard history projection", () => {
  it("normalizes Firestore timestamps", () => {
    expect(timestampIso(Timestamp.fromDate(new Date("2026-09-01T00:00:00Z"))))
      .toBe("2026-09-01T00:00:00.000Z");
    expect(timestampIso("2026-09-01")).toBeNull();
  });

  it("chooses the most useful date for sorting", () => {
    expect(historyDate({
      ...meetup("one", "SCHEDULING"),
      candidateDateTimes: ["2026-09-10T10:00:00.000Z"],
    })).toBe("2026-09-10T10:00:00.000Z");
  });

  it("counts only completed meetup places", () => {
    expect(mapPlaceVisits([
      meetup("one", "COMPLETED"),
      meetup("two", "COMPLETED"),
      meetup("three", "SCHEDULE_CONFIRMED"),
    ])).toEqual([{ place, count: 2, meetupIds: ["one", "two"] }]);
  });

  it("turns completed places into an oldest-first journey", () => {
    const first = {
      ...meetup("first", "COMPLETED"),
      confirmedDateTime: "2026-08-01T10:00:00.000Z",
    };
    const secondPlace = { ...place, placeId: "places/shibuya", name: "渋谷駅" };
    const second = {
      ...meetup("second", "COMPLETED"),
      completedAt: "2026-08-03T10:00:00.000Z",
      meetingPlace: null,
      planPlaces: [secondPlace, place],
    };

    expect(travelTimelineStops([second, first])).toEqual([
      expect.objectContaining({ id: "first:0", meetupId: "first", place }),
      expect.objectContaining({ id: "second:0", meetupId: "second", place: secondPlace }),
      expect.objectContaining({ id: "second:1", meetupId: "second", place }),
    ]);
  });
});
