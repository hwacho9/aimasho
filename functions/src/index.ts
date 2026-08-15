import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { rankSchedule } from "./scheduling/ranking.js";
import { getMapsProvider } from "./locations/provider.js";
import { geographicCenter, rankMeetingPoints } from "./locations/ranking.js";
import type { Location, MeetingPointMode } from "./locations/models.js";
import { calculateSettlement, type ExpenseInput } from "./settlement/settlement.js";
import { createInviteCode } from "./rooms/invite-code.js";
import type { CandidateSlot, Vote, VoteStatus } from "./shared/models.js";

if (getApps().length === 0) initializeApp();

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });
const db = getFirestore();

type MeetupStatus =
  | "SCHEDULING"
  | "SCHEDULE_CONFIRMED"
  | "LOCATION_COLLECTING"
  | "LOCATION_SELECTING"
  | "LOCATION_CONFIRMED"
  | "READY"
  | "COMPLETED";

interface CreateMeetupInput {
  displayName: string;
  title: string;
  description?: string;
  durationMinutes: number;
  candidateSlots: string[];
  roomId?: string | null;
}

type LocationInput = Location;

interface ExpensePayload {
  title: string;
  amount: number;
  paidByUid: string;
  participantUids: string[];
}

function requireUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  return uid;
}

function requireString(value: unknown, field: string, maxLength = 140): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new HttpsError("invalid-argument", `${field} is invalid.`);
  }
  return value.trim();
}

function requireVoteStatus(value: unknown): VoteStatus {
  if (value === "YES" || value === "MAYBE" || value === "NO") return value;
  throw new HttpsError("invalid-argument", "status must be YES, MAYBE, or NO.");
}

function parseIsoDate(value: unknown): string {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", "candidateSlots must contain valid ISO datetimes.");
  }
  return date.toISOString();
}

function requireIsoDateTime(value: unknown, field: string): Date {
  const raw = requireString(value, field);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError("invalid-argument", `${field} must be a valid ISO datetime.`);
  }
  return date;
}

function requireLocation(value: unknown, field = "location"): LocationInput {
  if (!value || typeof value !== "object") throw new HttpsError("invalid-argument", `${field} is invalid.`);
  const input = value as Partial<LocationInput>;
  const name = requireString(input.name, `${field}.name`, 160);
  const placeId = requireString(input.placeId, `${field}.placeId`, 256);
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number" || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) {
    throw new HttpsError("invalid-argument", `${field} coordinates are invalid.`);
  }
  return { placeId, name, ...(typeof input.address === "string" ? { address: input.address.slice(0, 300) } : {}), latitude: input.latitude, longitude: input.longitude };
}

function requireMeetingPointMode(value: unknown): MeetingPointMode {
  if (value === "FAIR" || value === "FAST") return value;
  throw new HttpsError("invalid-argument", "mode must be FAIR or FAST.");
}

function requireExpensePayload(value: unknown): ExpensePayload {
  if (!value || typeof value !== "object") throw new HttpsError("invalid-argument", "Expense input is invalid.");
  const input = value as Partial<ExpensePayload>;
  const title = requireString(input.title, "title", 120);
  const amount = input.amount;
  if (!Number.isInteger(amount) || amount === undefined || amount <= 0 || amount > 10_000_000) {
    throw new HttpsError("invalid-argument", "amount must be a positive integer yen amount.");
  }
  const paidByUid = requireString(input.paidByUid, "paidByUid", 128);
  if (!Array.isArray(input.participantUids) || input.participantUids.length === 0 || input.participantUids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new HttpsError("invalid-argument", "participantUids is invalid.");
  }
  return { title, amount, paidByUid, participantUids: [...new Set(input.participantUids)] };
}

async function validateExpenseParticipants(meetupId: string, expense: ExpensePayload): Promise<void> {
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  const participantSet = new Set(participants.docs.map((participant) => participant.id));
  if (!participantSet.has(expense.paidByUid) || expense.participantUids.some((id) => !participantSet.has(id))) {
    throw new HttpsError("invalid-argument", "Payer and sharers must be participants.");
  }
}

function mapsUrl(origin: Location, destination: Location): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${origin.latitude},${origin.longitude}`)}&destination=${encodeURIComponent(`${destination.latitude},${destination.longitude}`)}&travelmode=transit`;
}

/**
 * Stores a per-meetup notification job only when the participant has opted in
 * on a device. This keeps FCM tokens and scheduled jobs off the public meetup
 * document and lets recalculating a route replace a stale departure time.
 */
async function queueDepartureNotification(
  meetupId: string,
  uid: string,
  route: { departureTime: string },
  meetupTitle: string,
  meetingPlaceName: string,
): Promise<void> {
  const device = await db.doc(`users/${uid}/devices/default`).get();
  const token = device.data()?.token;
  if (typeof token !== "string" || token.length === 0) return;

  const departureTime = new Date(route.departureTime);
  if (Number.isNaN(departureTime.getTime())) return;
  await db.doc(`departureNotifications/${meetupId}_${uid}`).set({
    meetupId,
    uid,
    token,
    meetupTitle,
    meetingPlaceName,
    departureTime: Timestamp.fromDate(departureTime),
    status: "PENDING",
    attempts: 0,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function privateOrigin(meetupId: string, uid: string): Promise<Location | null> {
  const snapshot = await db.doc(`meetups/${meetupId}/privateOrigins/${uid}`).get();
  return snapshot.exists ? snapshot.data()?.origin as Location : null;
}

async function participantOrigins(meetupId: string): Promise<Array<{ uid: string; origin: Location }>> {
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  const origins = await Promise.all(participants.docs.map(async (participant) => ({ uid: participant.id, origin: await privateOrigin(meetupId, participant.id) })));
  return origins.flatMap((item) => item.origin ? [{ uid: item.uid, origin: item.origin }] : []);
}

async function requireParticipant(meetupId: string, uid: string) {
  const participant = await db.doc(`meetups/${meetupId}/participants/${uid}`).get();
  if (!participant.exists) throw new HttpsError("permission-denied", "You are not a meetup participant.");
  return participant;
}

async function requireHost(meetupId: string, uid: string) {
  const participant = await requireParticipant(meetupId, uid);
  if (participant.data()?.isHost !== true) {
    throw new HttpsError("permission-denied", "Only the host can do this.");
  }
}

interface RegisteredParticipant {
  uid: string;
  displayName: string;
}

function relationshipPairId(firstUid: string, secondUid: string): string {
  return Buffer.from([firstUid, secondUid].sort().join("\u0000")).toString("base64url");
}

async function isRegisteredUser(uid: string): Promise<boolean> {
  const profile = await db.doc(`users/${uid}`).get();
  return profile.data()?.accountType === "REGISTERED";
}

async function registeredParticipants(meetupId: string): Promise<RegisteredParticipant[]> {
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  if (participants.empty) return [];
  const profiles = await db.getAll(...participants.docs.map((participant) => db.doc(`users/${participant.id}`)));
  const profilesByUid = new Map(profiles.filter((profile) => profile.data()?.accountType === "REGISTERED").map((profile) => [profile.id, profile.data()]));
  return participants.docs.flatMap((participant) => {
    const profile = profilesByUid.get(participant.id);
    return profile ? [{ uid: participant.id, displayName: profile.displayName ?? participant.data().displayName ?? "aimasho user" }] : [];
  });
}

async function recordRelationshipPair(meetupId: string, first: RegisteredParticipant, second: RegisteredParticipant): Promise<void> {
  if (first.uid === second.uid) return;
  const pairId = relationshipPairId(first.uid, second.uid);
  const pair = db.doc(`meetups/${meetupId}/relationshipPairs/${pairId}`);
  const firstRelationship = db.doc(`users/${first.uid}/relationships/${second.uid}`);
  const secondRelationship = db.doc(`users/${second.uid}/relationships/${first.uid}`);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(pair)).exists) return;
    transaction.set(pair, { participantUids: [first.uid, second.uid].sort(), createdAt: FieldValue.serverTimestamp() });
    transaction.set(firstRelationship, { otherUid: second.uid, displayName: second.displayName, sharedMeetupCount: FieldValue.increment(1), lastMeetupId: meetupId, lastMeetupAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(secondRelationship, { otherUid: first.uid, displayName: first.displayName, sharedMeetupCount: FieldValue.increment(1), lastMeetupId: meetupId, lastMeetupAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

/** Records each registered pair once per meetup. Pair marker documents make this safe to retry. */
async function recordRelationshipsForMeetup(meetupId: string, onlyForUid?: string): Promise<void> {
  const participants = await registeredParticipants(meetupId);
  const pairs = onlyForUid
    ? participants.filter((participant) => participant.uid === onlyForUid).flatMap((participant) => participants.filter((other) => other.uid !== participant.uid).map((other) => [participant, other] as const))
    : participants.flatMap((participant, index) => participants.slice(index + 1).map((other) => [participant, other] as const));
  await Promise.all(pairs.map(([first, second]) => recordRelationshipPair(meetupId, first, second)));
}

async function recordRelationshipsForRegisteredUser(uid: string): Promise<void> {
  const participations = await db.collectionGroup("participants").where("uid", "==", uid).get();
  const meetupIds = new Set(participations.docs.map((participation) => participation.ref.parent.parent?.id).filter((meetupId): meetupId is string => Boolean(meetupId)));
  await Promise.all([...meetupIds].map((meetupId) => recordRelationshipsForMeetup(meetupId, uid)));
}

export const createMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const data = request.data as Partial<CreateMeetupInput>;
  const title = requireString(data.title, "title", 80);
  const description = data.description === undefined ? undefined : requireString(data.description, "description", 500);
  if (!Number.isInteger(data.durationMinutes) || (data.durationMinutes ?? 0) < 30 || (data.durationMinutes ?? 0) > 1440) {
    throw new HttpsError("invalid-argument", "durationMinutes must be between 30 and 1440.");
  }
  if (!Array.isArray(data.candidateSlots) || data.candidateSlots.length === 0 || data.candidateSlots.length > 12) {
    throw new HttpsError("invalid-argument", "Provide between 1 and 12 candidate slots.");
  }
  const candidateSlots = [...new Set(data.candidateSlots.map(parseIsoDate))].sort();
  const displayName = requireString(data.displayName, "displayName", 60);
  const roomId = data.roomId === undefined || data.roomId === null ? null : requireString(data.roomId, "roomId", 128);
  const roomMembers = roomId ? await db.collection(`rooms/${roomId}/members`).get() : null;
  if (roomId && roomMembers?.empty) throw new HttpsError("not-found", "Room not found.");
  if (roomId && !roomMembers?.docs.some((member) => member.id === uid)) throw new HttpsError("permission-denied", "You are not a Room member.");
  const meetup = db.collection("meetups").doc();
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  batch.set(meetup, {
    id: meetup.id,
    roomId,
    title,
    ...(description ? { description } : {}),
    createdByUid: uid,
    status: "SCHEDULING" satisfies MeetupStatus,
    durationMinutes: data.durationMinutes,
    arrivalBufferMinutes: 10,
    createdAt: now,
    updatedAt: now,
  });
  batch.set(meetup.collection("participants").doc(uid), {
    uid,
    displayName,
    isGuest: request.auth?.token.firebase?.sign_in_provider === "anonymous",
    isHost: true,
    joinedAt: now,
  });
  for (const member of roomMembers?.docs ?? []) {
    if (member.id === uid) continue;
    batch.set(meetup.collection("participants").doc(member.id), {
      uid: member.id,
      displayName: member.data().displayName,
      isGuest: false,
      isHost: false,
      joinedAt: now,
    });
  }
  for (const startDateTime of candidateSlots) {
    const slot = meetup.collection("candidateSlots").doc();
    batch.set(slot, { id: slot.id, startDateTime: Timestamp.fromDate(new Date(startDateTime)), createdAt: now });
  }
  await batch.commit();
  try {
    await recordRelationshipsForMeetup(meetup.id);
  } catch (caught) {
    console.error("Could not record meetup relationships", { meetupId: meetup.id, message: caught instanceof Error ? caught.message : "Unknown error" });
  }
  return { meetupId: meetup.id };
});

export const joinMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const displayName = requireString(request.data?.displayName, "displayName", 60);
  const meetup = db.doc(`meetups/${meetupId}`);
  if (!(await meetup.get()).exists) throw new HttpsError("not-found", "Meetup not found.");
  const participant = meetup.collection("participants").doc(uid);
  let joinedNow = false;
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(participant);
    if (existing.exists && existing.data()?.isHost === true) return;
    joinedNow = !existing.exists;
    transaction.set(participant, {
      uid,
      displayName,
      isGuest: request.auth?.token.firebase?.sign_in_provider === "anonymous",
      isHost: false,
      joinedAt: existing.data()?.joinedAt ?? FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  if (joinedNow) {
    try {
      await recordRelationshipsForMeetup(meetupId, uid);
    } catch (caught) {
      console.error("Could not record joined meetup relationships", { meetupId, uid, message: caught instanceof Error ? caught.message : "Unknown error" });
    }
  }
  return { meetupId };
});

/** The small, intentionally non-sensitive payload rendered before a guest joins. */
export const getMeetupInvitePreview = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
  const host = await meetup.ref.collection("participants").where("isHost", "==", true).limit(1).get();
  return {
    meetupId,
    title: meetup.data()?.title,
    description: meetup.data()?.description ?? null,
    status: meetup.data()?.status,
    hostName: host.docs[0]?.data().displayName ?? "A friend",
    isAlreadyParticipant: (await meetup.ref.collection("participants").doc(uid).get()).exists,
  };
});

/**
 * Small public payload used only for a shared link's Open Graph card. It only
 * exposes the title the host chose to share, never a description, participants,
 * votes, origins, or any other meetup state.
 */
export const getPublicMeetupMetadata = onRequest({ cors: true }, async (request, response) => {
  const meetupId = typeof request.query.meetupId === "string" ? request.query.meetupId.trim() : "";
  if (!meetupId || meetupId.length > 128) {
    response.status(400).json({ error: "meetupId is invalid" });
    return;
  }
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  if (!meetup.exists) {
    response.status(404).json({ error: "Meetup not found" });
    return;
  }
  const data = meetup.data();
  const title = typeof data?.title === "string" && data.title.trim() ? data.title.trim() : "aimasho meetup";
  response.set("Cache-Control", "public, max-age=300, s-maxage=300");
  response.status(200).json({ title });
});

export const upsertVote = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const slotId = requireString(request.data?.slotId, "slotId", 128);
  const status = requireVoteStatus(request.data?.status);
  await requireParticipant(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const [meetupSnapshot, slot] = await Promise.all([
    meetup.get(),
    db.doc(`meetups/${meetupId}/candidateSlots/${slotId}`).get(),
  ]);
  if (!meetupSnapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (meetupSnapshot.data()?.status !== "SCHEDULING") {
    throw new HttpsError("failed-precondition", "Voting is closed after the schedule is confirmed.");
  }
  if (!slot.exists) throw new HttpsError("not-found", "Candidate slot not found.");
  await db.doc(`meetups/${meetupId}/votes/${uid}_${slotId}`).set({
    participantUid: uid,
    slotId,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

export const calculateScheduleRecommendation = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const [participants, slots, votes] = await Promise.all([
    meetup.collection("participants").get(),
    meetup.collection("candidateSlots").get(),
    meetup.collection("votes").get(),
  ]);
  const slotModels: CandidateSlot[] = slots.docs.map((slot) => ({
    id: slot.id,
    startDateTime: slot.data().startDateTime.toDate().toISOString(),
  }));
  const voteModels: Vote[] = votes.docs.map((vote) => ({
    participantUid: vote.data().participantUid,
    slotId: vote.data().slotId,
    status: vote.data().status as VoteStatus,
  }));
  return rankSchedule(slotModels, voteModels, participants.size);
});

export const confirmSchedule = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  // The client sends the candidate it was showing, but the server always
  // recalculates the winner from the latest votes before it confirms anything.
  // This prevents a stale screen (or a hand-crafted request) from confirming
  // a different candidate from the actual vote result.
  requireString(request.data?.slotId, "slotId", 128);
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const confirmation = await db.runTransaction(async (transaction) => {
    const [meetupSnapshot, slotsSnapshot, votesSnapshot, participantsSnapshot] = await Promise.all([
      transaction.get(meetup),
      transaction.get(meetup.collection("candidateSlots")),
      transaction.get(meetup.collection("votes")),
      transaction.get(meetup.collection("participants")),
    ]);
    if (!meetupSnapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
    if (meetupSnapshot.data()?.status !== "SCHEDULING") {
      throw new HttpsError("failed-precondition", "The schedule has already been confirmed.");
    }
    const recommendation = rankSchedule(
      slotsSnapshot.docs.map((slot) => ({
        id: slot.id,
        startDateTime: (slot.data().startDateTime as Timestamp).toDate().toISOString(),
      })),
      votesSnapshot.docs.map((vote) => ({
        participantUid: vote.data().participantUid,
        slotId: vote.data().slotId,
        status: vote.data().status as VoteStatus,
      })),
      participantsSnapshot.size,
    ).recommended;
    if (!recommendation) throw new HttpsError("failed-precondition", "At least one candidate slot is required.");
    const winner = slotsSnapshot.docs.find((slot) => slot.id === recommendation.id);
    if (!winner) throw new HttpsError("internal", "The recommended candidate slot was not found.");
    const value = winner.data().startDateTime as Timestamp;
    transaction.update(meetup, {
      status: "SCHEDULE_CONFIRMED" satisfies MeetupStatus,
      confirmedDateTime: value,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { slotId: winner.id, confirmedDateTime: value.toDate().toISOString() };
  });
  return { status: "SCHEDULE_CONFIRMED", ...confirmation };
});

/**
 * Lets the host revise a confirmed date/time. Meeting place and private
 * origins remain intact, while routes and departure notifications are removed
 * because both are tied to the previous arrival time.
 */
export const updateConfirmedSchedule = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const confirmedDate = requireIsoDateTime(request.data?.confirmedDateTime, "confirmedDateTime");
  await requireHost(meetupId, uid);

  const meetup = db.doc(`meetups/${meetupId}`);
  const meetupSnapshot = await meetup.get();
  if (!meetupSnapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  const previousStatus = meetupSnapshot.data()?.status as MeetupStatus | undefined;
  if (!previousStatus || previousStatus === "SCHEDULING") {
    throw new HttpsError("failed-precondition", "Confirm a schedule before changing it.");
  }
  if (previousStatus === "COMPLETED") {
    throw new HttpsError("failed-precondition", "Completed meetups cannot be changed.");
  }

  const [routes, notifications, participants] = await Promise.all([
    meetup.collection("routes").get(),
    db.collection("departureNotifications").where("meetupId", "==", meetupId).get(),
    meetup.collection("participants").get(),
  ]);
  if (routes.size + notifications.size + participants.size > 450) {
    throw new HttpsError("resource-exhausted", "Too many stale route records to reset at once.");
  }

  const nextStatus: MeetupStatus = meetupSnapshot.data()?.meetingPlace
    ? "LOCATION_CONFIRMED"
    : "SCHEDULE_CONFIRMED";
  const batch = db.batch();
  batch.update(meetup, {
    previousConfirmedDateTime: meetupSnapshot.data()?.confirmedDateTime ?? FieldValue.delete(),
    confirmedDateTime: Timestamp.fromDate(confirmedDate),
    scheduleChangedAt: FieldValue.serverTimestamp(),
    status: nextStatus,
    targetArrivalTime: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  routes.docs.forEach((route) => batch.delete(route.ref));
  notifications.docs.forEach((notification) => batch.delete(notification.ref));
  participants.docs.forEach((participant) => batch.update(participant.ref, {
    confirmedScheduleAvailability: FieldValue.delete(),
    confirmedScheduleAvailabilityUpdatedAt: FieldValue.delete(),
  }));
  await batch.commit();

  return {
    status: nextStatus,
    confirmedDateTime: confirmedDate.toISOString(),
    routesReset: routes.size,
  };
});

/** Lets every participant revise only their own availability for the confirmed schedule. */
export const updateConfirmedScheduleAvailability = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const status = requireVoteStatus(request.data?.status);
  const participant = await requireParticipant(meetupId, uid);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  const meetupStatus = meetup.data()?.status as MeetupStatus | undefined;
  if (!meetup.exists || !meetupStatus || meetupStatus === "SCHEDULING" || meetupStatus === "COMPLETED") {
    throw new HttpsError("failed-precondition", "A confirmed upcoming schedule is required.");
  }
  await participant.ref.set({
    confirmedScheduleAvailability: status,
    confirmedScheduleAvailabilityUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { status };
});

export const searchPlaces = onCall(async (request) => {
  requireUid(request.auth?.uid);
  const query = requireString(request.data?.query, "query", 160);
  const near = request.data?.near ? requireLocation(request.data.near, "near") : undefined;
  try {
    const places = await getMapsProvider().searchPlaces(query, near);
    return { places };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown Places API error.";
    console.error("searchPlaces failed", { message });
    if (message.startsWith("Google Places request failed")) {
      throw new HttpsError("failed-precondition", "Google Places API access was denied. Check the server key, billing, and Places API settings.");
    }
    throw caught;
  }
});

export const saveOrigin = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const origin = requireLocation(request.data?.origin, "origin");
  await requireParticipant(meetupId, uid);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (!["SCHEDULE_CONFIRMED", "LOCATION_COLLECTING", "LOCATION_SELECTING"].includes(meetup.data()?.status)) {
    throw new HttpsError("failed-precondition", "Origins can be saved only after the schedule is confirmed.");
  }
  const batch = db.batch();
  batch.set(db.doc(`meetups/${meetupId}/privateOrigins/${uid}`), { uid, origin, updatedAt: FieldValue.serverTimestamp() });
  batch.set(db.doc(`meetups/${meetupId}/participants/${uid}`), { hasOrigin: true, originArea: origin.name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (meetup.data()?.status === "SCHEDULE_CONFIRMED") batch.update(meetup.ref, { status: "LOCATION_COLLECTING" satisfies MeetupStatus, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { hasOrigin: true, originArea: origin.name };
});

export const getOriginCollectionStatus = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  return { participants: participants.docs.map((participant) => ({ uid: participant.id, displayName: participant.data().displayName, hasOrigin: participant.data().hasOrigin === true, originArea: participant.id === uid ? participant.data().originArea ?? null : null })), completeCount: participants.docs.filter((participant) => participant.data().hasOrigin === true).length };
});

export const beginLocationSelection = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireHost(meetupId, uid);
  const origins = await participantOrigins(meetupId);
  if (origins.length < 2) throw new HttpsError("failed-precondition", "At least two origins are needed to choose a meeting place.");
  await db.doc(`meetups/${meetupId}`).update({ status: "LOCATION_SELECTING" satisfies MeetupStatus, updatedAt: FieldValue.serverTimestamp() });
  return { status: "LOCATION_SELECTING" };
});

export const getMeetingPointRecommendations = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const mode = requireMeetingPointMode(request.data?.mode ?? "FAIR");
  await requireParticipant(meetupId, uid);
  const origins = await participantOrigins(meetupId);
  if (origins.length < 2) throw new HttpsError("failed-precondition", "At least two participants need an origin first.");
  const provider = getMapsProvider();
  try {
    const candidates = await provider.candidatePlaces(geographicCenter(origins.map((item) => item.origin)));
    const matrix = await provider.calculateMatrix(origins.map((item) => item.origin), candidates);
    return { mode, candidates: rankMeetingPoints(candidates, matrix.durations, origins.map((item) => item.uid), mode).slice(0, 3) };
  } catch (caught) {
    console.error("getMeetingPointRecommendations failed", { meetupId, message: caught instanceof Error ? caught.message : "Unknown Routes API error" });
    throw new HttpsError("failed-precondition", "Route calculation is temporarily unavailable. Check the Routes API and try again.");
  }
});

export const confirmMeetingPlace = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const meetingPlace = requireLocation(request.data?.meetingPlace, "meetingPlace");
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const snapshot = await meetup.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (!["LOCATION_COLLECTING", "LOCATION_SELECTING", "LOCATION_CONFIRMED", "READY"].includes(snapshot.data()?.status)) throw new HttpsError("failed-precondition", "Confirm the schedule and collect origins first.");
  await meetup.update({ meetingPlace, status: "LOCATION_CONFIRMED" satisfies MeetupStatus, updatedAt: FieldValue.serverTimestamp() });
  return { meetingPlace };
});

export const calculateRoutes = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  const data = meetup.data();
  if (!meetup.exists || !data?.meetingPlace || !data.confirmedDateTime) throw new HttpsError("failed-precondition", "Meeting place and date must be confirmed first.");
  const meetingPlace = data.meetingPlace as Location;
  const targetArrival = new Date((data.confirmedDateTime as Timestamp).toDate().getTime() - (data.arrivalBufferMinutes ?? 10) * 60_000);
  const origins = await participantOrigins(meetupId);
  const provider = getMapsProvider();
  const batch = db.batch();
  let routes: Array<{ participantUid: string; durationMinutes: number; transfers: number; routeSummary: string; isEstimate: boolean; externalMapsUrl: string; departureTime: string; arrivalTime: string }>;
  try {
    routes = await Promise.all(origins.map(async ({ uid: participantUid, origin }) => {
      // Transit routing accepts an arrival time, so every participant's route is
      // calculated to reach the meeting point by the shared target arrival.
      const route = await provider.calculateRoute(origin, meetingPlace, targetArrival);
      const departureTime = new Date(targetArrival.getTime() - route.durationMinutes * 60_000);
      const item = { participantUid, durationMinutes: route.durationMinutes, transfers: route.transfers ?? 0, routeSummary: route.routeSummary ?? `${origin.name} → ${meetingPlace.name}`, isEstimate: route.isEstimate === true, externalMapsUrl: mapsUrl(origin, meetingPlace), departureTime: departureTime.toISOString(), arrivalTime: targetArrival.toISOString() };
      batch.set(db.doc(`meetups/${meetupId}/routes/${participantUid}`), { ...item, calculatedAt: FieldValue.serverTimestamp() });
      return item;
    }));
  } catch (caught) {
    console.error("calculateRoutes failed", { meetupId, message: caught instanceof Error ? caught.message : "Unknown Routes API error" });
    throw new HttpsError("failed-precondition", "Route calculation is temporarily unavailable. Check the Routes API and try again.");
  }
  batch.update(meetup.ref, { status: "READY" satisfies MeetupStatus, targetArrivalTime: Timestamp.fromDate(targetArrival), updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  await Promise.all(routes.map((route) => queueDepartureNotification(
    meetupId,
    route.participantUid,
    route,
    data.title as string,
    meetingPlace.name,
  )));
  return { meetingPlace, targetArrivalTime: targetArrival.toISOString(), routes };
});

/** Registers the caller's current device for their own calculated departure. */
export const registerDeviceToken = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const token = requireString(request.data?.token, "token", 4096);
  await requireParticipant(meetupId, uid);
  await db.doc(`users/${uid}/devices/default`).set({
    token,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const [meetup, route] = await Promise.all([
    db.doc(`meetups/${meetupId}`).get(),
    db.doc(`meetups/${meetupId}/routes/${uid}`).get(),
  ]);
  const meetupData = meetup.data();
  if (route.exists && meetupData?.meetingPlace) {
    await queueDepartureNotification(
      meetupId,
      uid,
      route.data() as { departureTime: string },
      meetupData.title as string,
      (meetupData.meetingPlace as Location).name,
    );
  }
  return { registered: true };
});

/** Delivers due departure reminders. Deploying this function requires Cloud Scheduler. */
export const sendDepartureNotifications = onSchedule("every 1 minutes", async () => {
  const due = await db.collection("departureNotifications")
    .where("status", "==", "PENDING")
    .where("departureTime", "<=", Timestamp.now())
    .limit(100)
    .get();

  await Promise.all(due.docs.map(async (notification) => {
    const job = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(notification.ref);
      const data = current.data();
      if (!current.exists || data?.status !== "PENDING" || !(data.departureTime instanceof Timestamp) || data.departureTime.toMillis() > Date.now()) return null;
      transaction.update(notification.ref, {
        status: "SENDING",
        attempts: (data.attempts ?? 0) + 1,
        claimedAt: FieldValue.serverTimestamp(),
      });
      return data;
    });
    if (!job) return;

    try {
      await getMessaging().send({
        token: job.token as string,
        notification: {
          title: "🚃 출발할 시간이에요",
          body: `${job.meetingPlaceName as string}에서 만나요 · ${job.meetupTitle as string}`,
        },
        data: { meetupId: job.meetupId as string, type: "departure-reminder" },
      });
      await notification.ref.update({ status: "SENT", sentAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    } catch (error) {
      const attempts = (job.attempts ?? 0) + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown FCM error";
      const invalidToken = /registration-token-not-registered|invalid-registration-token/.test(message);
      await notification.ref.update({
        status: invalidToken ? "INVALID_TOKEN" : attempts >= 3 ? "FAILED" : "PENDING",
        lastError: message,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }));
});

export const createExpense = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const input = requireExpensePayload(request.data);
  await requireParticipant(meetupId, uid);
  await validateExpenseParticipants(meetupId, input);
  const expense = db.collection(`meetups/${meetupId}/expenses`).doc();
  await expense.set({ id: expense.id, ...input, createdByUid: uid, createdAt: FieldValue.serverTimestamp() });
  return { expenseId: expense.id };
});

export const updateExpense = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const expenseId = requireString(request.data?.expenseId, "expenseId", 128);
  const input = requireExpensePayload(request.data);
  await requireParticipant(meetupId, uid);
  const expense = db.doc(`meetups/${meetupId}/expenses/${expenseId}`);
  const snapshot = await expense.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Expense not found.");
  if (snapshot.data()?.createdByUid !== uid) throw new HttpsError("permission-denied", "Only the expense creator can edit it.");
  await validateExpenseParticipants(meetupId, input);
  await expense.update({ ...input, updatedAt: FieldValue.serverTimestamp() });
  return { expenseId };
});

export const deleteExpense = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const expenseId = requireString(request.data?.expenseId, "expenseId", 128);
  await requireParticipant(meetupId, uid);
  const expense = db.doc(`meetups/${meetupId}/expenses/${expenseId}`);
  const snapshot = await expense.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Expense not found.");
  if (snapshot.data()?.createdByUid !== uid) throw new HttpsError("permission-denied", "Only the expense creator can delete it.");
  await expense.delete();
  return { expenseId };
});

export const calculateSettlementResult = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  const [participants, expenses] = await Promise.all([db.collection(`meetups/${meetupId}/participants`).get(), db.collection(`meetups/${meetupId}/expenses`).get()]);
  const result = calculateSettlement(participants.docs.map((participant) => participant.id), expenses.docs.map((expense) => expense.data() as ExpenseInput));
  return result;
});

export const saveProfile = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const displayName = requireString(request.data?.displayName, "displayName", 60);
  const accountType = request.auth?.token.firebase?.sign_in_provider === "anonymous" ? "ANONYMOUS" : "REGISTERED";
  await db.doc(`users/${uid}`).set({ uid, displayName, accountType, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  if (accountType === "REGISTERED") {
    try {
      await recordRelationshipsForRegisteredUser(uid);
    } catch (caught) {
      console.error("Could not backfill profile relationships", { uid, message: caught instanceof Error ? caught.message : "Unknown error" });
    }
  }
  return { uid, displayName, accountType };
});

export const getMeetupRelationships = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  if (!(await isRegisteredUser(uid))) return { relationships: [] };
  await recordRelationshipsForMeetup(meetupId, uid);
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  const relationships = await db.getAll(...participants.docs.filter((participant) => participant.id !== uid).map((participant) => db.doc(`users/${uid}/relationships/${participant.id}`)));
  return {
    relationships: relationships.flatMap((relationship) => relationship.exists ? [{
      otherUid: relationship.id,
      displayName: relationship.data()?.displayName ?? "aimasho user",
      sharedMeetupCount: relationship.data()?.sharedMeetupCount ?? 0,
      lastMeetupId: relationship.data()?.lastMeetupId ?? null,
    }] : []),
  };
});

export const getMyRelationships = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  if (!(await isRegisteredUser(uid))) return { relationships: [] };
  await recordRelationshipsForRegisteredUser(uid);
  const relationships = await db.collection(`users/${uid}/relationships`).orderBy("lastMeetupAt", "desc").limit(100).get();
  return {
    relationships: relationships.docs.map((relationship) => ({
      otherUid: relationship.id,
      displayName: relationship.data().displayName ?? "aimasho user",
      sharedMeetupCount: relationship.data().sharedMeetupCount ?? 0,
      lastMeetupId: relationship.data().lastMeetupId ?? null,
    })),
  };
});

export const saveDefaultOrigin = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  if (request.auth?.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("failed-precondition", "Create an account to save a default origin.");
  const defaultOrigin = requireLocation(request.data?.defaultOrigin, "defaultOrigin");
  await db.doc(`users/${uid}`).set({ uid, defaultOrigin, updatedAt: FieldValue.serverTimestamp(), createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return { defaultOrigin };
});

async function requireRegisteredUser(uid: string, provider: string | undefined): Promise<void> {
  if (provider === "anonymous") throw new HttpsError("failed-precondition", "Create an account to use Rooms.");
  const profile = await db.doc(`users/${uid}`).get();
  if (!profile.exists || profile.data()?.accountType !== "REGISTERED") throw new HttpsError("failed-precondition", "Create an account to use Rooms.");
}

export const createRoom = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  await requireRegisteredUser(uid, request.auth?.token.firebase?.sign_in_provider);
  const name = requireString(request.data?.name, "name", 80);
  const displayName = requireString(request.data?.displayName, "displayName", 60);
  const room = db.collection("rooms").doc();
  const inviteCode = createInviteCode();
  const batch = db.batch();
  batch.set(room, { id: room.id, name, ownerUid: uid, inviteCode, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  batch.set(room.collection("members").doc(uid), { uid, displayName, role: "OWNER", joinedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { roomId: room.id, inviteCode };
});

export const getRoomInvitePreview = onCall(async (request) => {
  requireUid(request.auth?.uid);
  const inviteCode = requireString(request.data?.inviteCode, "inviteCode", 32).toUpperCase();
  const rooms = await db.collection("rooms").where("inviteCode", "==", inviteCode).limit(1).get();
  const room = rooms.docs[0];
  if (!room) throw new HttpsError("not-found", "Room not found.");
  const owner = await room.ref.collection("members").where("role", "==", "OWNER").limit(1).get();
  return { roomId: room.id, name: room.data().name, ownerName: owner.docs[0]?.data().displayName ?? "A friend" };
});

export const joinRoom = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  await requireRegisteredUser(uid, request.auth?.token.firebase?.sign_in_provider);
  const inviteCode = requireString(request.data?.inviteCode, "inviteCode", 32).toUpperCase();
  const displayName = requireString(request.data?.displayName, "displayName", 60);
  const rooms = await db.collection("rooms").where("inviteCode", "==", inviteCode).limit(1).get();
  const room = rooms.docs[0];
  if (!room) throw new HttpsError("not-found", "Room not found.");
  await room.ref.collection("members").doc(uid).set({ uid, displayName, role: "MEMBER", joinedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { roomId: room.id };
});

export const getMyRooms = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  await requireRegisteredUser(uid, request.auth?.token.firebase?.sign_in_provider);
  const memberships = await db.collectionGroup("members").where("uid", "==", uid).get();
  const rooms = await Promise.all(memberships.docs.map(async (membership) => {
    const room = await membership.ref.parent.parent?.get();
    return room?.exists ? { id: room.id, name: room.data()?.name, inviteCode: room.data()?.inviteCode, role: membership.data().role } : null;
  }));
  return { rooms: rooms.filter((room): room is NonNullable<typeof room> => room !== null) };
});

export const getRoomDetail = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const roomId = requireString(request.data?.roomId, "roomId", 128);
  const room = await db.doc(`rooms/${roomId}`).get();
  if (!room.exists) throw new HttpsError("not-found", "Room not found.");
  const membership = await room.ref.collection("members").doc(uid).get();
  if (!membership.exists) throw new HttpsError("permission-denied", "You are not a Room member.");
  const [members, meetups] = await Promise.all([room.ref.collection("members").get(), db.collection("meetups").where("roomId", "==", roomId).get()]);
  return { room: { id: room.id, name: room.data()?.name, inviteCode: room.data()?.inviteCode, ownerUid: room.data()?.ownerUid }, members: members.docs.map((member) => member.data()), meetups: meetups.docs.map((meetup) => ({ id: meetup.id, title: meetup.data().title, status: meetup.data().status, confirmedDateTime: meetup.data().confirmedDateTime?.toDate().toISOString() ?? null })) };
});
