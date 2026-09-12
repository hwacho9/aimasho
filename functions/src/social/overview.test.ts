import { describe, expect, it } from "vitest";
import { buildSocialOverview, friendshipMilestone, type SocialEvent } from "./overview.js";

const base: SocialEvent = { id: "one", title: "Lunch", status: "COMPLETED", date: "2026-09-01T12:00:00Z", placeName: "Tokyo", participants: [
  { uid: "me", displayName: "Me", registered: true },
  { uid: "friend", displayName: "Friend", registered: true },
  { uid: "guest", displayName: "Guest", registered: false },
] };
describe("private social overview", () => {
  it("deduplicates and separates completed, planned and cancelled events", () => {
    const result = buildSocialOverview("me", [base, base, { ...base, id: "planned", status: "SCHEDULING" }, { ...base, id: "cancelled", status: "CANCELLED" }]);
    expect(result.friends).toHaveLength(1);
    expect(result.friends[0]).toMatchObject({ completedCount: 1, plannedCount: 1 });
    expect(result.memories).toHaveLength(1);
  });
  it("never counts declined participation or exposes a stranger's event", () => {
    expect(buildSocialOverview("stranger", [base])).toEqual({ friends: [], memories: [] });
    const declined = { ...base, participants: base.participants.map((person) => ({ ...person, availability: "NO" })) };
    expect(buildSocialOverview("me", [declined]).memories).toHaveLength(0);
    const friendDeclined = { ...base, participants: base.participants.map((person) => ({ ...person, availability: person.uid === "friend" ? "NO" : "YES" })) };
    expect(buildSocialOverview("me", [friendDeclined]).friends).toHaveLength(0);
  });
  it("uses event dates for first and last shared memories", () => {
    const result = buildSocialOverview("me", [base, { ...base, id: "old", date: "2026-08-01T12:00:00Z" }]);
    expect(result.friends[0].firstMetAt).toBe("2026-08-01T12:00:00Z");
    expect(result.friends[0].lastMetAt).toBe(base.date);
    expect(result.memories[0].id).toBe("one");
  });
  it("calculates transparent milestones, not an invented friendship score", () => {
    expect(friendshipMilestone(0)).toEqual({ level: 0, next: 1, progress: 0 });
    expect(friendshipMilestone(2)).toEqual({ level: 1, next: 3, progress: 0.5 });
    expect(friendshipMilestone(30)).toEqual({ level: 5, next: null, progress: 1 });
  });
});
