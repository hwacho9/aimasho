import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";
import type { Location } from "../locations/models.js";
import type { MeetupStatus } from "../shared/domain-validation.js";

export interface HistoryMeetupPayload {
  id: string;
  title: string;
  status: MeetupStatus;
  confirmedDateTime: string | null;
  completedAt: string | null;
  meetingPlace: Location | null;
  planPlaces: Location[];
  candidateDateTimes: string[];
  roomId: string | null;
  isOwner?: boolean;
}

export interface TravelTimelineStop {
  id: string;
  meetupId: string;
  title: string;
  visitedAt: string;
  sequence: number;
  place: Location;
}

export function timestampIso(value: unknown): string | null {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export function historyDate(meetup: HistoryMeetupPayload): string {
  return meetup.confirmedDateTime
    ?? meetup.candidateDateTimes[0]
    ?? meetup.completedAt
    ?? "";
}

export async function historyMeetupPayload(
  snapshot: DocumentSnapshot,
): Promise<HistoryMeetupPayload> {
  const data = snapshot.data();
  const confirmedDateTime = timestampIso(data?.confirmedDateTime);
  const completedAt = timestampIso(data?.completedAt);
  const status = data?.status as MeetupStatus;
  const [plans, candidateSlots] = await Promise.all([
    status === "COMPLETED"
      ? snapshot.ref.collection("planItems").get()
      : Promise.resolve(null),
    !confirmedDateTime && !completedAt
      ? snapshot.ref.collection("candidateSlots").orderBy("startDateTime").limit(1).get()
      : Promise.resolve(null),
  ]);
  const planPlaces = (plans?.docs ?? [])
    .filter((item) => item.data()?.status === "completed" && item.data()?.place)
    .sort((a, b) => (a.data().order ?? 0) - (b.data().order ?? 0))
    .map((item) => item.data().place as Location);
  return {
    id: snapshot.id,
    title: data?.title ?? "aimasho meetup",
    status,
    confirmedDateTime,
    completedAt,
    meetingPlace: data?.meetingPlace ? data.meetingPlace as Location : null,
    planPlaces,
    candidateDateTimes: (candidateSlots?.docs ?? []).flatMap((slot) => {
      const value = timestampIso(slot.data()?.startDateTime);
      return value ? [value] : [];
    }),
    roomId: typeof data?.roomId === "string" ? data.roomId : null,
  };
}

/**
 * Lightweight dashboard projection. It intentionally skips plan-item reads;
 * the home only needs the first candidate for an unconfirmed meetup.
 */
export async function dashboardMeetupPayload(
  snapshot: DocumentSnapshot,
  ownerUid: string,
): Promise<HistoryMeetupPayload> {
  const data = snapshot.data();
  const confirmedDateTime = timestampIso(data?.confirmedDateTime);
  const completedAt = timestampIso(data?.completedAt);
  const firstCandidate = !confirmedDateTime && !completedAt
    ? await snapshot.ref.collection("candidateSlots").orderBy("startDateTime").limit(1).get()
    : null;
  const candidateDate = firstCandidate?.docs[0]
    ? timestampIso(firstCandidate.docs[0].data()?.startDateTime)
    : null;
  return {
    id: snapshot.id,
    title: data?.title ?? "aimasho meetup",
    status: data?.status as MeetupStatus,
    confirmedDateTime,
    completedAt,
    meetingPlace: data?.meetingPlace ? data.meetingPlace as Location : null,
    planPlaces: [],
    candidateDateTimes: candidateDate ? [candidateDate] : [],
    roomId: typeof data?.roomId === "string" ? data.roomId : null,
    isOwner: data?.createdByUid === ownerUid,
  };
}

export function mapPlaceVisits(meetups: HistoryMeetupPayload[]) {
  const places = new Map<string, {
    place: Location;
    count: number;
    meetupIds: string[];
  }>();
  for (const meetup of meetups.filter((item) => item.status === "COMPLETED")) {
    const usedPlaces = meetup.planPlaces.length > 0
      ? meetup.planPlaces
      : meetup.meetingPlace
        ? [meetup.meetingPlace]
        : [];
    for (const place of usedPlaces) {
      const current = places.get(place.placeId) ?? {
        place,
        count: 0,
        meetupIds: [],
      };
      current.count += 1;
      if (!current.meetupIds.includes(meetup.id)) current.meetupIds.push(meetup.id);
      places.set(place.placeId, current);
    }
  }
  return [...places.values()].sort(
    (first, second) => second.count - first.count
      || first.place.name.localeCompare(second.place.name),
  );
}

/**
 * Builds a chronological journey from places the user deliberately stored on
 * completed meetups. This is appointment history, not continuous GPS history.
 */
export function travelTimelineStops(
  meetups: HistoryMeetupPayload[],
): TravelTimelineStop[] {
  const completed = meetups
    .filter((meetup) => meetup.status === "COMPLETED")
    .map((meetup) => ({
      meetup,
      visitedAt: meetup.confirmedDateTime ?? meetup.completedAt ?? "",
    }))
    .filter(({ visitedAt }) => Boolean(visitedAt))
    .sort((first, second) => first.visitedAt.localeCompare(second.visitedAt));

  return completed.flatMap(({ meetup, visitedAt }) => {
    const places = meetup.planPlaces.length > 0
      ? meetup.planPlaces
      : meetup.meetingPlace
        ? [meetup.meetingPlace]
        : [];
    return places.map((place, sequence) => ({
      id: `${meetup.id}:${sequence}`,
      meetupId: meetup.id,
      title: meetup.title,
      visitedAt,
      sequence,
      place,
    }));
  });
}
