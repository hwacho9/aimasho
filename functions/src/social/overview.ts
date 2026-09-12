export interface SocialEvent {
  id: string;
  title: string;
  status: string;
  date: string | null;
  placeName: string | null;
  participants: { uid: string; displayName: string; registered: boolean; availability?: string }[];
}

export function friendshipMilestone(count: number) {
  const thresholds = [0, 1, 3, 8, 15, 30];
  const level = thresholds.filter((threshold) => count >= threshold).length - 1;
  const floor = thresholds[level];
  const next = thresholds[level + 1] ?? null;
  return { level, next, progress: next === null ? 1 : (count - floor) / (next - floor) };
}

/** Only shared events are exposed. A completed record is not proof of physical attendance. */
export function buildSocialOverview(uid: string, events: SocialEvent[]) {
  const friends = new Map<string, {
    uid: string; displayName: string; completedCount: number; plannedCount: number;
    lastMetAt: string | null; firstMetAt: string | null; lastMeetupId: string;
  }>();
  const memories: SocialEvent[] = [];
  const unique = new Map(events.map((event) => [event.id, event]));
  for (const event of unique.values()) {
    const own = event.participants.find((member) => member.uid === uid);
    if (!own || own.availability === "NO" || event.status === "CANCELLED") continue;
    const completed = event.status === "COMPLETED";
    if (completed) memories.push(event);
    for (const person of event.participants) {
      if (person.uid === uid || !person.registered || person.availability === "NO") continue;
      const friend = friends.get(person.uid) ?? {
        uid: person.uid, displayName: person.displayName, completedCount: 0,
        plannedCount: 0, lastMetAt: null, firstMetAt: null, lastMeetupId: event.id,
      };
      if (completed) {
        friend.completedCount += 1;
        if (event.date && (!friend.lastMetAt || event.date > friend.lastMetAt)) {
          friend.lastMetAt = event.date;
          friend.lastMeetupId = event.id;
        }
        if (event.date && (!friend.firstMetAt || event.date < friend.firstMetAt)) friend.firstMetAt = event.date;
      } else {
        friend.plannedCount += 1;
      }
      friends.set(person.uid, friend);
    }
  }
  return {
    friends: [...friends.values()].map((friend) => ({ ...friend, milestone: friendshipMilestone(friend.completedCount) }))
      .sort((a, b) => b.completedCount - a.completedCount || (b.lastMetAt ?? "").localeCompare(a.lastMetAt ?? "") || a.displayName.localeCompare(b.displayName)),
    memories: memories.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).map((event) => ({
      id: event.id, title: event.title, date: event.date, placeName: event.placeName,
      companions: event.participants.filter((person) => person.uid !== uid && person.availability !== "NO")
        .map(({ uid: personUid, displayName }) => ({ uid: personUid, displayName })),
    })),
  };
}
