"use client";

import { updateProfile } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ensureAnonymousUser, firebase } from "@/lib/firebase/client";
import type { AvailabilityVote, CandidateSlot, Expense, InvitePreview, Location, Meetup, MeetupDetail, MeetingPointCandidate, OriginCollectionStatus, Participant, ParticipantRoute, Recommendation, Room, Settlement, VoteStatus } from "@/types/meetup";

const callable = <Input, Output>(name: string) => httpsCallable<Input, Output>(firebase().functions, name);

function dateString(value: unknown): string | undefined {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return undefined;
}

export async function identify(name: string) {
  const user = await ensureAnonymousUser();
  if (user.displayName !== name) await updateProfile(user, { displayName: name });
  return user;
}

export async function createMeetup(input: { hostName: string; title: string; description?: string; durationMinutes: number; candidateSlots: string[]; roomId?: string }) {
  await identify(input.hostName);
  const { hostName, ...values } = input;
  const payload = { ...values, displayName: hostName };
  const response = await callable<typeof payload, { meetupId: string }>("createMeetup")(payload);
  return response.data.meetupId;
}

export async function getInvitePreview(meetupId: string) {
  await ensureAnonymousUser();
  const response = await callable<{ meetupId: string }, InvitePreview>("getMeetupInvitePreview")({ meetupId });
  return response.data;
}

export async function joinMeetup(meetupId: string, displayName: string) {
  await identify(displayName);
  await callable<{ meetupId: string; displayName: string }, { meetupId: string }>("joinMeetup")({ meetupId, displayName });
}

export async function submitVote(meetupId: string, slotId: string, status: VoteStatus) {
  await ensureAnonymousUser();
  await callable<{ meetupId: string; slotId: string; status: VoteStatus }, { ok: true }>("upsertVote")({ meetupId, slotId, status });
}

export async function getRecommendation(meetupId: string): Promise<Recommendation> {
  await ensureAnonymousUser();
  const response = await callable<{ meetupId: string }, Recommendation>("calculateScheduleRecommendation")({ meetupId });
  return response.data;
}

export async function confirmSchedule(meetupId: string, slotId: string) {
  await callable<{ meetupId: string; slotId: string }, { status: string }>("confirmSchedule")({ meetupId, slotId });
}

export async function searchPlaces(query: string): Promise<Location[]> {
  await ensureAnonymousUser();
  const response = await callable<{ query: string }, { places: Location[] }>("searchPlaces")({ query });
  return response.data.places;
}

export async function saveOrigin(meetupId: string, origin: Location) {
  await callable<{ meetupId: string; origin: Location }, { hasOrigin: true }>("saveOrigin")({ meetupId, origin });
}

export async function getOriginCollectionStatus(meetupId: string): Promise<OriginCollectionStatus> {
  const response = await callable<{ meetupId: string }, OriginCollectionStatus>("getOriginCollectionStatus")({ meetupId });
  return response.data;
}

export async function beginLocationSelection(meetupId: string) {
  await callable<{ meetupId: string }, { status: string }>("beginLocationSelection")({ meetupId });
}

export async function getMeetingPointRecommendations(meetupId: string, mode: "FAIR" | "FAST") {
  const response = await callable<{ meetupId: string; mode: "FAIR" | "FAST" }, { candidates: MeetingPointCandidate[] }>("getMeetingPointRecommendations")({ meetupId, mode });
  return response.data.candidates;
}

export async function confirmMeetingPlace(meetupId: string, meetingPlace: Location) {
  await callable<{ meetupId: string; meetingPlace: Location }, { meetingPlace: Location }>("confirmMeetingPlace")({ meetupId, meetingPlace });
}

export async function calculateRoutes(meetupId: string) {
  const response = await callable<{ meetupId: string }, { routes: ParticipantRoute[]; targetArrivalTime: string }>("calculateRoutes")({ meetupId });
  return response.data;
}

export async function createExpense(meetupId: string, input: { title: string; amount: number; paidByUid: string; participantUids: string[] }) {
  const response = await callable<{ meetupId: string } & typeof input, { expenseId: string }>("createExpense")({ meetupId, ...input });
  return response.data.expenseId;
}

export async function getSettlement(meetupId: string): Promise<Settlement> {
  const response = await callable<{ meetupId: string }, Settlement>("calculateSettlementResult")({ meetupId });
  return response.data;
}

export async function saveProfile(displayName: string) {
  const response = await callable<{ displayName: string }, { uid: string; displayName: string; accountType: string }>("saveProfile")({ displayName });
  return response.data;
}

export async function saveDefaultOrigin(defaultOrigin: Location) {
  await callable<{ defaultOrigin: Location }, { defaultOrigin: Location }>("saveDefaultOrigin")({ defaultOrigin });
}

export async function createRoom(name: string, displayName: string) {
  const response = await callable<{ name: string; displayName: string }, { roomId: string; inviteCode: string }>("createRoom")({ name, displayName });
  return response.data;
}

export async function getMyRooms(): Promise<Room[]> {
  const response = await callable<Record<string, never>, { rooms: Room[] }>("getMyRooms")({});
  return response.data.rooms;
}

export async function joinRoom(inviteCode: string, displayName: string) {
  const response = await callable<{ inviteCode: string; displayName: string }, { roomId: string }>("joinRoom")({ inviteCode, displayName });
  return response.data.roomId;
}

export async function getRoomInvitePreview(inviteCode: string) {
  const response = await callable<{ inviteCode: string }, { roomId: string; name: string; ownerName: string }>("getRoomInvitePreview")({ inviteCode });
  return response.data;
}

export async function getRoomDetail(roomId: string): Promise<{ room: { id: string; name: string; inviteCode: string; ownerUid: string }; members: Array<{ uid: string; displayName: string; role: "OWNER" | "MEMBER" }>; meetups: Array<{ id: string; title: string; status: string; confirmedDateTime: string | null }> }> {
  const response = await callable<{ roomId: string }, { room: { id: string; name: string; inviteCode: string; ownerUid: string }; members: Array<{ uid: string; displayName: string; role: "OWNER" | "MEMBER" }>; meetups: Array<{ id: string; title: string; status: string; confirmedDateTime: string | null }> }>("getRoomDetail")({ roomId });
  return response.data;
}

export function subscribeToMeetup(meetupId: string, onData: (data: MeetupDetail) => void, onError: (error: Error) => void) {
  const { db } = firebase();
  let meetup: Meetup | undefined;
  let participants: Participant[] = [];
  let candidateSlots: CandidateSlot[] = [];
  let votes: AvailabilityVote[] = [];
  let routes: ParticipantRoute[] = [];
  let expenses: Expense[] = [];
  const publish = () => {
    if (meetup) onData({ meetup, participants, candidateSlots, votes, routes, expenses });
  };
  const base = doc(db, "meetups", meetupId);
  const stops = [
    onSnapshot(base, (snapshot) => {
      if (!snapshot.exists()) return onError(new Error("약속을 찾을 수 없어요."));
      const item = snapshot.data();
      meetup = {
        id: snapshot.id,
        title: item.title,
        description: item.description,
        createdByUid: item.createdByUid,
        status: item.status,
        durationMinutes: item.durationMinutes,
        confirmedDateTime: dateString(item.confirmedDateTime),
        meetingPlace: item.meetingPlace,
        arrivalBufferMinutes: item.arrivalBufferMinutes,
        targetArrivalTime: dateString(item.targetArrivalTime),
      };
      publish();
    }, onError),
    onSnapshot(collection(base, "participants"), (snapshot) => {
      participants = snapshot.docs.map((item) => item.data() as Participant);
      publish();
    }, onError),
    onSnapshot(query(collection(base, "candidateSlots"), orderBy("startDateTime")), (snapshot) => {
      candidateSlots = snapshot.docs.map((item) => ({ id: item.id, startDateTime: dateString(item.data().startDateTime) ?? "" }));
      publish();
    }, onError),
    onSnapshot(collection(base, "votes"), (snapshot) => {
      votes = snapshot.docs.map((item) => item.data() as AvailabilityVote);
      publish();
    }, onError),
    onSnapshot(collection(base, "routes"), (snapshot) => {
      routes = snapshot.docs.map((item) => item.data() as ParticipantRoute);
      publish();
    }, onError),
    onSnapshot(collection(base, "expenses"), (snapshot) => {
      expenses = snapshot.docs.map((item) => item.data() as Expense);
      publish();
    }, onError),
  ];
  return () => stops.forEach((stop) => stop());
}
