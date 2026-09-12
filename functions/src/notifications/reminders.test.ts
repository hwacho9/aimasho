import { describe, expect, it } from "vitest";
import { meetupReminderCopy, meetupReminderTimes } from "./reminders.js";

describe("meetup reminders", () => {
  it("creates reminders one day and one hour before a future meetup", () => {
    const meetupAt = new Date("2026-09-03T10:00:00.000Z");
    const times = meetupReminderTimes(
      meetupAt,
      new Date("2026-09-01T00:00:00.000Z"),
    );
    expect(times.map((item) => item.sendAt.toISOString())).toEqual([
      "2026-09-02T10:00:00.000Z",
      "2026-09-03T09:00:00.000Z",
      "2026-09-03T09:50:00.000Z",
    ]);
  });

  it("does not recreate reminder times that have already passed", () => {
    const times = meetupReminderTimes(
      new Date("2026-09-03T10:00:00.000Z"),
      new Date("2026-09-03T08:30:00.000Z"),
    );
    expect(times.map((item) => item.minutesBefore)).toEqual([60, 10]);
  });

  it("localizes notification copy", () => {
    expect(meetupReminderCopy("ko", "저녁 약속", 60).title).toContain("1시간");
    expect(meetupReminderCopy("ja", "夕食", 1440).title).toContain("明日");
    expect(meetupReminderCopy("ko", "카페", 10).title).toContain("10분");
  });
});
