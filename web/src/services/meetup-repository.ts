"use client";

import { updateProfile } from "firebase/auth";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ensureAnonymousUser, firebase, trackAnalyticsEvent } from "@/lib/firebase/client";
import type { AvailabilityVote, CandidateSlot, ContentCategory, ContentOption, ContentVote, ContentVoteConfig, Expense, FriendHistory, HomeDashboardData, InvitePreview, Location, Meetup, MeetupDetail, MeetingPointCandidate, OriginCollectionStatus, Participant, ParticipantRoute, PlanItem, PlanItemStatus, PlanItemType, Recommendation, RelationshipStat, Room, RoomDetailData, ScheduleCondition, Settlement, VoteStatus } from "@/types/meetup";

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

export async function createMeetup(input: { hostName: string; title: string; description?: string; durationMinutes: number; candidateSlots: string[]; roomId?: string; collectOrigins?: boolean; allowParticipantSlotAdd?: boolean; responseDeadline?: string; scheduleCondition?: ScheduleCondition; contentVoteConfig?: ContentVoteConfig; allowPlanEditing?: boolean }) {
  const { hostName, description, ...values } = input;
  const normalizedHostName = hostName.trim();
  await identify(normalizedHostName);
  const trimmedDescription = description?.trim();
  const payload = {
    ...values,
    title: values.title.trim(),
    displayName: normalizedHostName,
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
  };
  const response = await callable<typeof payload, { meetupId: string }>("createMeetup")(payload);
  trackAnalyticsEvent("meetup_created");
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
  trackAnalyticsEvent("meetup_joined");
}

export async function submitVote(meetupId: string, slotId: string, status: VoteStatus, comment?: string) {
  await ensureAnonymousUser();
  await callable<{ meetupId: string; slotId: string; status: VoteStatus; comment?: string }, { ok: true }>("upsertVote")({ meetupId, slotId, status, ...(comment?.trim() ? { comment: comment.trim() } : {}) });
}

export async function addCandidateSlot(meetupId: string, startDateTime: string) {
  await ensureAnonymousUser();
  await callable<{ meetupId: string; startDateTime: string }, { id: string; startDateTime: string }>("addCandidateSlot")({ meetupId, startDateTime });
  trackAnalyticsEvent("candidate_slot_added");
}

export async function toggleContentVote(meetupId: string, optionId: string, selected: boolean) {
  await callable<{ meetupId: string; optionId: string; selected: boolean }, { selected: boolean }>("toggleContentVote")({ meetupId, optionId, selected });
  trackAnalyticsEvent("content_vote_updated");
}

export async function addContentOption(meetupId: string, category: ContentCategory, label: string) {
  await callable<{ meetupId: string; category: ContentCategory; label: string }, { id: string }>("addContentOption")({ meetupId, category, label });
}

export type PlanItemInput = { type: PlanItemType; title: string; place?: Location; scheduledAt?: string; note?: string; source?: "manual" | "vote" | "recommendation" };
export async function createPlanItem(meetupId: string, item: PlanItemInput) {
  const response = await callable<{ meetupId: string; item: PlanItemInput }, { id: string }>("createPlanItem")({ meetupId, item });
  trackAnalyticsEvent("plan_item_created");
  return response.data.id;
}
export async function updatePlanItem(meetupId: string, itemId: string, item: PlanItemInput) {
  await callable<{ meetupId: string; itemId: string; item: PlanItemInput }, { id: string }>("updatePlanItem")({ meetupId, itemId, item });
}
export async function deletePlanItem(meetupId: string, itemId: string) {
  await callable<{ meetupId: string; itemId: string }, { id: string }>("deletePlanItem")({ meetupId, itemId });
}
export async function reorderPlanItems(meetupId: string, itemIds: string[]) {
  await callable<{ meetupId: string; itemIds: string[] }, { ok: true }>("reorderPlanItems")({ meetupId, itemIds });
}
export async function setPlanItemStatus(meetupId: string, itemId: string, status: PlanItemStatus) {
  await callable<{ meetupId: string; itemId: string; status: PlanItemStatus }, { status: PlanItemStatus }>("setPlanItemStatus")({ meetupId, itemId, status });
}
export async function completeMeetup(meetupId: string) {
  await callable<{ meetupId: string }, { status: string }>("completeMeetup")({ meetupId });
  trackAnalyticsEvent("meetup_completed");
}
export async function cancelMeetup(meetupId: string) {
  await callable<{ meetupId: string }, { status: string }>("cancelMeetup")({ meetupId });
}

export async function deleteMeetup(meetupId: string) {
  await callable<{ meetupId: string }, { meetupId: string }>("deleteMeetup")({ meetupId });
  trackAnalyticsEvent("meetup_deleted");
}

export async function getRecommendation(meetupId: string): Promise<Recommendation> {
  await ensureAnonymousUser();
  const response = await callable<{ meetupId: string }, Recommendation>("calculateScheduleRecommendation")({ meetupId });
  return response.data;
}

export async function confirmSchedule(meetupId: string, slotId: string) {
  await callable<{ meetupId: string; slotId: string }, { status: string }>("confirmSchedule")({ meetupId, slotId });
  trackAnalyticsEvent("schedule_confirmed");
}

export async function updateConfirmedSchedule(meetupId: string, confirmedDateTime: string) {
  await callable<{ meetupId: string; confirmedDateTime: string }, { status: string; confirmedDateTime: string; routesReset: number }>("updateConfirmedSchedule")({ meetupId, confirmedDateTime });
  trackAnalyticsEvent("schedule_updated");
}

export async function updateConfirmedScheduleAvailability(meetupId: string, status: VoteStatus) {
  await callable<{ meetupId: string; status: VoteStatus }, { status: VoteStatus }>("updateConfirmedScheduleAvailability")({ meetupId, status });
  trackAnalyticsEvent("confirmed_schedule_availability_updated");
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
  trackAnalyticsEvent("meeting_place_confirmed");
}

export async function calculateRoutes(meetupId: string) {
  const response = await callable<{ meetupId: string }, { routes: ParticipantRoute[]; targetArrivalTime: string }>("calculateRoutes")({ meetupId });
  trackAnalyticsEvent("routes_calculated");
  return response.data;
}

export async function createExpense(meetupId: string, input: { title: string; amount: number; paidByUid: string; participantUids: string[] }) {
  const response = await callable<{ meetupId: string } & typeof input, { expenseId: string }>("createExpense")({ meetupId, ...input });
  trackAnalyticsEvent("expense_created");
  return response.data.expenseId;
}

export async function updateExpense(meetupId: string, expenseId: string, input: { title: string; amount: number; paidByUid: string; participantUids: string[] }) {
  await callable<{ meetupId: string; expenseId: string } & typeof input, { expenseId: string }>("updateExpense")({ meetupId, expenseId, ...input });
  trackAnalyticsEvent("expense_updated");
}

export async function deleteExpense(meetupId: string, expenseId: string) {
  await callable<{ meetupId: string; expenseId: string }, { expenseId: string }>("deleteExpense")({ meetupId, expenseId });
  trackAnalyticsEvent("expense_deleted");
}

export async function getSettlement(meetupId: string): Promise<Settlement> {
  const response = await callable<{ meetupId: string }, Settlement>("calculateSettlementResult")({ meetupId });
  return response.data;
}

export async function saveProfile(displayName: string) {
  const response = await callable<{ displayName: string }, { uid: string; displayName: string; accountType: string }>("saveProfile")({ displayName });
  return response.data;
}

export async function getMeetupRelationships(meetupId: string): Promise<RelationshipStat[]> {
  const response = await callable<{ meetupId: string }, { relationships: RelationshipStat[] }>("getMeetupRelationships")({ meetupId });
  return response.data.relationships;
}

export async function getMyRelationships(): Promise<RelationshipStat[]> {
  const response = await callable<Record<string, never>, { relationships: RelationshipStat[] }>("getMyRelationships")({});
  return response.data.relationships;
}

export async function getFriendHistory(otherUid: string): Promise<FriendHistory> {
  const response = await callable<{ otherUid: string }, FriendHistory>("getFriendHistory")({ otherUid });
  return response.data;
}

export async function saveDefaultOrigin(defaultOrigin: Location) {
  await callable<{ defaultOrigin: Location }, { defaultOrigin: Location }>("saveDefaultOrigin")({ defaultOrigin });
}

export async function createRoom(name: string, displayName: string) {
  const response = await callable<{ name: string; displayName: string }, { roomId: string; inviteCode: string }>("createRoom")({ name, displayName });
  trackAnalyticsEvent("room_created");
  return response.data;
}

export async function deleteRoom(roomId: string) {
  const response = await callable<{ roomId: string }, { roomId: string; preservedMeetupCount: number }>("deleteRoom")({ roomId });
  trackAnalyticsEvent("room_deleted");
  return response.data;
}

export async function getMyRooms(): Promise<Room[]> {
  const response = await callable<Record<string, never>, { rooms: Room[] }>("getMyRooms")({});
  return response.data.rooms;
}

export async function getMyDashboard(): Promise<HomeDashboardData> {
  const response = await callable<Record<string, never>, HomeDashboardData>("getMyDashboard")({});
  return response.data;
}

export async function joinRoom(inviteCode: string, displayName: string) {
  const response = await callable<{ inviteCode: string; displayName: string }, { roomId: string }>("joinRoom")({ inviteCode, displayName });
  trackAnalyticsEvent("room_joined");
  return response.data.roomId;
}

export async function getRoomInvitePreview(inviteCode: string) {
  const response = await callable<{ inviteCode: string }, { roomId: string; name: string; ownerName: string }>("getRoomInvitePreview")({ inviteCode });
  return response.data;
}

export async function getRoomDetail(roomId: string): Promise<RoomDetailData> {
  const response = await callable<{ roomId: string }, RoomDetailData>("getRoomDetail")({ roomId });
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
  let contentOptions: ContentOption[] = [];
  let contentVotes: ContentVote[] = [];
  let planItems: PlanItem[] = [];
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const publish = () => {
    if (!meetup) return;
    if (publishTimer) clearTimeout(publishTimer);
    // The nine listeners usually deliver their initial snapshots together.
    // Coalescing them avoids rendering the entire meetup nine times.
    publishTimer = setTimeout(() => {
      if (meetup) onData({ meetup, participants, candidateSlots, votes, routes, expenses, contentOptions, contentVotes, planItems });
    }, 20);
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
        collectOrigins: item.collectOrigins !== false,
        allowParticipantSlotAdd: item.allowParticipantSlotAdd === true,
        responseDeadline: dateString(item.responseDeadline),
        scheduleCondition: item.scheduleCondition,
        contentVoteConfig: item.contentVoteConfig,
        allowPlanEditing: item.allowPlanEditing === true,
        completedAt: dateString(item.completedAt),
        cancelledAt: dateString(item.cancelledAt),
        confirmedDateTime: dateString(item.confirmedDateTime),
        previousConfirmedDateTime: dateString(item.previousConfirmedDateTime),
        scheduleChangedAt: dateString(item.scheduleChangedAt),
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
      candidateSlots = snapshot.docs.map((item) => ({ id: item.id, startDateTime: dateString(item.data().startDateTime) ?? "", createdByUid: item.data().createdByUid }));
      publish();
    }, onError),
    onSnapshot(collection(base, "votes"), (snapshot) => {
      votes = snapshot.docs.map((item) => ({ ...item.data(), comment: typeof item.data().comment === "string" ? item.data().comment : undefined }) as AvailabilityVote);
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
    onSnapshot(collection(base, "contentOptions"), (snapshot) => {
      contentOptions = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as ContentOption);
      publish();
    }, onError),
    onSnapshot(collection(base, "contentVotes"), (snapshot) => {
      contentVotes = snapshot.docs.map((item) => item.data() as ContentVote);
      publish();
    }, onError),
    onSnapshot(query(collection(base, "planItems"), orderBy("order")), (snapshot) => {
      planItems = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), scheduledAt: dateString(item.data().scheduledAt), completedAt: dateString(item.data().completedAt) }) as PlanItem);
      publish();
    }, onError),
  ];
  return () => {
    if (publishTimer) clearTimeout(publishTimer);
    stops.forEach((stop) => stop());
  };
}
