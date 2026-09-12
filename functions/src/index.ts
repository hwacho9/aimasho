import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore, type DocumentSnapshot } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  dashboardMeetupPayload,
  historyDate,
  historyMeetupPayload,
  mapPlaceVisits,
  travelTimelineStops,
} from "./dashboard/history.js";
import { rankSchedule } from "./scheduling/ranking.js";
import { getMapsProvider } from "./locations/provider.js";
import { geographicCenter, rankMeetingPoints } from "./locations/ranking.js";
import type { Location } from "./locations/models.js";
import {
  MEETUP_REMINDER_MINUTES,
  meetupReminderCopy,
  meetupReminderTimes,
} from "./notifications/reminders.js";
import { calculateSettlement, type ExpenseInput } from "./settlement/settlement.js";
import { createInviteCode } from "./rooms/invite-code.js";
import {
  recordRelationshipsForMeetup,
  recordRelationshipsForRegisteredUser,
} from "./relationships/service.js";
import {
  contentVotingEnabled,
  defaultContentOptions,
  requireContentCategory,
  requireContentVoteConfig,
  requireExpensePayload,
  requireLocation,
  requireMeetingPointMode,
  requirePlanItemPayload,
  requirePlanItemStatus,
  requireScheduleCondition,
  responseDeadlineHasPassed,
  type ContentCategory,
  type CreateMeetupInput,
  type ExpensePayload,
  type MeetupStatus,
  type PlanItemStatus,
} from "./shared/domain-validation.js";
import type { CandidateSlot, Vote, VoteStatus } from "./shared/models.js";
import {
  optionalIsoDateTime,
  parseIsoDate,
  requireBoolean,
  requireIsoDateTime,
  requireString,
  requireVoteStatus,
} from "./shared/validation.js";

if (getApps().length === 0) initializeApp();

setGlobalOptions({ region: "asia-northeast1", maxInstances: 10 });
const db = getFirestore();

export { getMyMeetups, getMySocialOverview, getMeetupMemories, saveMeetupMemory, deleteMeetupMemory } from "./social/service.js";

// Google Maps Platform does not provide Japanese public-transit timetables to
// this app. Keep the feature off until a timetable provider is connected.
const DEPARTURE_TIME_FEATURE_ENABLED = false;

function requireUid(uid: string | undefined): string {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in is required.");
  return uid;
}

async function validateExpenseParticipants(meetupId: string, expense: ExpensePayload): Promise<void> {
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  const participantSet = new Set(participants.docs.map((participant) => participant.id));
  if (!participantSet.has(expense.paidByUid) || expense.participantUids.some((id) => !participantSet.has(id))) {
    throw new HttpsError("invalid-argument", "Payer and sharers must be participants.");
  }
}

function mapsUrl(origin: Location, destination: Location): string {
  // Maps URLs cannot carry a planned transit departure or arrival time.  Use
  // Places IDs, rather than station coordinates, so Google Maps opens the
  // intended station instead of a nearby rail-track coordinate.
  const placeId = (value: string) => value.replace(/^places\//, "");
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin.name)}&origin_place_id=${encodeURIComponent(placeId(origin.placeId))}&destination=${encodeURIComponent(destination.name)}&destination_place_id=${encodeURIComponent(placeId(destination.placeId))}&travelmode=transit`;
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

function meetupReminderJobId(meetupId: string, uid: string, minutesBefore: number): string {
  return `${meetupId}_${uid}_${minutesBefore}`;
}

async function savePushToken(uid: string, token: string, platform: unknown): Promise<void> {
  await db.doc(`users/${uid}/devices/default`).set({
    token,
    platform: platform === "android" ? "android" : "ios",
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function deleteMeetupReminderJobs(meetupId: string): Promise<number> {
  const jobs = await db.collection("meetupReminders").where("meetupId", "==", meetupId).get();
  if (jobs.empty) return 0;
  const writer = db.bulkWriter();
  jobs.docs.forEach((job) => writer.delete(job.ref));
  await writer.close();
  return jobs.size;
}

async function replaceUserMeetupReminderJobs(
  meetupId: string,
  uid: string,
  meetupTitle: string,
  meetupAt: Date,
  locale: string,
  enabled: boolean,
): Promise<number> {
  const batch = db.batch();
  for (const minutesBefore of MEETUP_REMINDER_MINUTES) {
    batch.delete(db.doc(`meetupReminders/${meetupReminderJobId(meetupId, uid, minutesBefore)}`));
  }
  let count = 0;
  if (enabled) {
    for (const reminder of meetupReminderTimes(meetupAt)) {
      count += 1;
      batch.set(db.doc(`meetupReminders/${meetupReminderJobId(meetupId, uid, reminder.minutesBefore)}`), {
        meetupId,
        uid,
        meetupTitle,
        meetupAt: Timestamp.fromDate(meetupAt),
        minutesBefore: reminder.minutesBefore,
        locale,
        sendAt: Timestamp.fromDate(reminder.sendAt),
        status: "PENDING",
        attempts: 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }
  await batch.commit();
  return count;
}

async function replaceMeetupReminderJobs(
  meetupId: string,
  meetupTitle: string,
  meetupAt: Date,
): Promise<void> {
  const preferences = await db.collection("meetupReminderPreferences")
    .where("meetupId", "==", meetupId)
    .get();
  await deleteMeetupReminderJobs(meetupId);
  await Promise.all(preferences.docs.map(async (preference) => {
    const data = preference.data();
    if (data.enabled !== true || typeof data.uid !== "string") return;
    await replaceUserMeetupReminderJobs(
      meetupId,
      data.uid,
      meetupTitle,
      meetupAt,
      data.locale === "ko" ? "ko" : "ja",
      true,
    );
  }));
}

async function safelyReplaceMeetupReminderJobs(
  meetupId: string,
  meetupTitle: string,
  meetupAt: Date,
): Promise<void> {
  try {
    await replaceMeetupReminderJobs(meetupId, meetupTitle, meetupAt);
  } catch (caught) {
    console.error("Could not reschedule meetup reminders", {
      meetupId,
      message: caught instanceof Error ? caught.message : "Unknown error",
    });
  }
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

export const createMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const data = request.data as Partial<CreateMeetupInput>;
  const title = requireString(data.title, "title", 80);
  const description = data.description === undefined
    || data.description === null
    || (typeof data.description === "string" && data.description.trim() === "")
    ? undefined
    : requireString(data.description, "description", 500);
  if (!Number.isInteger(data.durationMinutes) || (data.durationMinutes ?? 0) < 30 || (data.durationMinutes ?? 0) > 1440) {
    throw new HttpsError("invalid-argument", "durationMinutes must be between 30 and 1440.");
  }
  if (!Array.isArray(data.candidateSlots) || data.candidateSlots.length === 0 || data.candidateSlots.length > 12) {
    throw new HttpsError("invalid-argument", "Provide between 1 and 12 candidate slots.");
  }
  const candidateSlots = [...new Set(data.candidateSlots.map(parseIsoDate))].sort();
  const displayName = requireString(data.displayName, "displayName", 60);
  const roomId = data.roomId === undefined || data.roomId === null ? null : requireString(data.roomId, "roomId", 128);
  const collectOrigins = requireBoolean(data.collectOrigins, "collectOrigins", true);
  const allowParticipantSlotAdd = requireBoolean(data.allowParticipantSlotAdd, "allowParticipantSlotAdd", false);
  const responseDeadline = optionalIsoDateTime(data.responseDeadline, "responseDeadline");
  const scheduleCondition = requireScheduleCondition(data.scheduleCondition);
  const contentVoteConfig = requireContentVoteConfig(data.contentVoteConfig);
  const allowPlanEditing = requireBoolean(data.allowPlanEditing, "allowPlanEditing", false);
  if (responseDeadline && responseDeadline.getTime() <= Date.now()) {
    throw new HttpsError("invalid-argument", "responseDeadline must be in the future.");
  }
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
    collectOrigins,
    allowParticipantSlotAdd,
    ...(responseDeadline ? { responseDeadline: Timestamp.fromDate(responseDeadline) } : {}),
    ...(scheduleCondition ? { scheduleCondition } : {}),
    contentVoteConfig,
    allowPlanEditing,
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
    batch.set(slot, { id: slot.id, startDateTime: Timestamp.fromDate(new Date(startDateTime)), createdByUid: uid, createdAt: now });
  }
  for (const category of ["FOOD", "ACTIVITY"] as ContentCategory[]) {
    if (!contentVotingEnabled(contentVoteConfig, category)) continue;
    for (const label of defaultContentOptions[category]) {
      const option = meetup.collection("contentOptions").doc();
      batch.set(option, { id: option.id, category, label, builtIn: true, createdByUid: uid, createdAt: now });
    }
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
  const comment = request.data?.comment === undefined || request.data?.comment === null || request.data?.comment === ""
    ? undefined
    : requireString(request.data.comment, "comment", 240);
  await requireParticipant(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const [meetupSnapshot, slot] = await Promise.all([
    meetup.get(),
    db.doc(`meetups/${meetupId}/candidateSlots/${slotId}`).get(),
  ]);
  if (!meetupSnapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  const meetupStatus = meetupSnapshot.data()?.status as MeetupStatus | undefined;
  if (!meetupStatus || meetupStatus === "COMPLETED" || meetupStatus === "CANCELLED") {
    throw new HttpsError("failed-precondition", "Voting is closed for a finished meetup.");
  }
  if (meetupStatus === "SCHEDULING" && responseDeadlineHasPassed(meetupSnapshot.data()?.responseDeadline)) {
    throw new HttpsError("failed-precondition", "The response deadline has passed.");
  }
  if (!slot.exists) throw new HttpsError("not-found", "Candidate slot not found.");
  await db.doc(`meetups/${meetupId}/votes/${uid}_${slotId}`).set({
    participantUid: uid,
    slotId,
    status,
    ...(comment ? { comment } : { comment: FieldValue.delete() }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

/** Adds a candidate slot when the host has opened candidate suggestions. */
export const addCandidateSlot = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const startDateTime = requireIsoDateTime(request.data?.startDateTime, "startDateTime");
  const meetup = db.doc(`meetups/${meetupId}`);
  const participant = await requireParticipant(meetupId, uid);
  const snapshot = await meetup.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  const meetupStatus = snapshot.data()?.status as MeetupStatus | undefined;
  if (!meetupStatus || meetupStatus === "COMPLETED" || meetupStatus === "CANCELLED") {
    throw new HttpsError("failed-precondition", "Candidate dates cannot be added to a finished meetup.");
  }
  if (meetupStatus === "SCHEDULING" && responseDeadlineHasPassed(snapshot.data()?.responseDeadline)) {
    throw new HttpsError("failed-precondition", "The response deadline has passed.");
  }
  if (participant.data()?.isHost !== true && snapshot.data()?.allowParticipantSlotAdd !== true) {
    throw new HttpsError("permission-denied", "The host has not opened candidate suggestions.");
  }
  const slots = await meetup.collection("candidateSlots").get();
  if (slots.size >= 24) throw new HttpsError("resource-exhausted", "A meetup can have up to 24 candidate slots.");
  if (slots.docs.some((slot) => (slot.data().startDateTime as Timestamp).toMillis() === startDateTime.getTime())) {
    throw new HttpsError("already-exists", "This candidate date already exists.");
  }
  const slot = meetup.collection("candidateSlots").doc();
  await slot.set({
    id: slot.id,
    startDateTime: Timestamp.fromDate(startDateTime),
    createdByUid: uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: slot.id, startDateTime: startDateTime.toISOString() };
});

/** Selects or clears a food/activity option for the caller. */
export const toggleContentVote = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const optionId = requireString(request.data?.optionId, "optionId", 128);
  const selected = requireBoolean(request.data?.selected, "selected", true);
  await requireParticipant(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const [meetupSnapshot, option] = await Promise.all([
    meetup.get(),
    meetup.collection("contentOptions").doc(optionId).get(),
  ]);
  if (!meetupSnapshot.exists || !option.exists) throw new HttpsError("not-found", "Meetup or content option not found.");
  const status = meetupSnapshot.data()?.status as MeetupStatus | undefined;
  if (!status || status === "COMPLETED" || status === "CANCELLED") throw new HttpsError("failed-precondition", "Content voting is closed.");
  const category = requireContentCategory(option.data()?.category);
  const config = requireContentVoteConfig(meetupSnapshot.data()?.contentVoteConfig);
  if (!contentVotingEnabled(config, category)) throw new HttpsError("failed-precondition", "This content vote is disabled.");
  const vote = meetup.collection("contentVotes").doc(`${uid}_${optionId}`);
  if (!selected) {
    await vote.delete();
    return { selected: false };
  }
  const batch = db.batch();
  if (!config.allowMultiple) {
    const existing = await meetup.collection("contentVotes").where("participantUid", "==", uid).get();
    existing.docs.filter((item) => item.data().category === category && item.id !== vote.id).forEach((item) => batch.delete(item.ref));
  }
  batch.set(vote, { participantUid: uid, optionId, category, updatedAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return { selected: true };
});

/** Lets participants propose a custom food/activity option when the host allows it. */
export const addContentOption = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const category = requireContentCategory(request.data?.category);
  const label = requireString(request.data?.label, "label", 60);
  const participant = await requireParticipant(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const snapshot = await meetup.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  const status = snapshot.data()?.status as MeetupStatus | undefined;
  if (!status || status === "COMPLETED" || status === "CANCELLED") throw new HttpsError("failed-precondition", "Content voting is closed.");
  const config = requireContentVoteConfig(snapshot.data()?.contentVoteConfig);
  if (!contentVotingEnabled(config, category)) throw new HttpsError("failed-precondition", "This content vote is disabled.");
  if (participant.data()?.isHost !== true && !config.allowParticipantOptions) throw new HttpsError("permission-denied", "The host has not opened option suggestions.");
  const existing = await meetup.collection("contentOptions").where("category", "==", category).get();
  if (existing.docs.some((item) => String(item.data().label).toLocaleLowerCase() === label.toLocaleLowerCase())) throw new HttpsError("already-exists", "This option already exists.");
  const option = meetup.collection("contentOptions").doc();
  await option.set({ id: option.id, category, label, createdByUid: uid, builtIn: false, createdAt: FieldValue.serverTimestamp() });
  return { id: option.id };
});

async function requirePlanEditor(meetupId: string, uid: string) {
  const [participant, meetup] = await Promise.all([requireParticipant(meetupId, uid), db.doc(`meetups/${meetupId}`).get()]);
  if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
  const status = meetup.data()?.status as MeetupStatus | undefined;
  if (!status || status === "COMPLETED" || status === "CANCELLED") throw new HttpsError("failed-precondition", "The event plan is not editable.");
  if (participant.data()?.isHost !== true && meetup.data()?.allowPlanEditing !== true) throw new HttpsError("permission-denied", "Only the host can edit this plan.");
  return { participant, meetup };
}

export const createPlanItem = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const item = requirePlanItemPayload(request.data?.item);
  const { meetup } = await requirePlanEditor(meetupId, uid);
  const existing = await meetup.ref.collection("planItems").get();
  if (existing.size >= 100) throw new HttpsError("resource-exhausted", "A plan can have up to 100 items.");
  const order = existing.docs.reduce((maximum, current) => Math.max(maximum, Number(current.data().order) || 0), 0) + 1000;
  const ref = meetup.ref.collection("planItems").doc();
  await ref.set({ id: ref.id, ...item, ...(item.scheduledAt ? { scheduledAt: Timestamp.fromDate(item.scheduledAt) } : {}), status: "planned" satisfies PlanItemStatus, order, createdByUid: uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return { id: ref.id };
});

export const updatePlanItem = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const itemId = requireString(request.data?.itemId, "itemId", 128);
  const item = requirePlanItemPayload(request.data?.item);
  const { meetup } = await requirePlanEditor(meetupId, uid);
  const ref = meetup.ref.collection("planItems").doc(itemId);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "Plan item not found.");
  await ref.update({ ...item, ...(item.scheduledAt ? { scheduledAt: Timestamp.fromDate(item.scheduledAt) } : { scheduledAt: FieldValue.delete() }), ...(item.note ? { note: item.note } : { note: FieldValue.delete() }), ...(item.place ? { place: item.place } : { place: FieldValue.delete() }), updatedAt: FieldValue.serverTimestamp() });
  return { id: itemId };
});

export const deletePlanItem = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const itemId = requireString(request.data?.itemId, "itemId", 128);
  const { meetup } = await requirePlanEditor(meetupId, uid);
  await meetup.ref.collection("planItems").doc(itemId).delete();
  return { id: itemId };
});

export const reorderPlanItems = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  if (!Array.isArray(request.data?.itemIds) || request.data.itemIds.length > 100 || request.data.itemIds.some((id: unknown) => typeof id !== "string" || id.length === 0)) throw new HttpsError("invalid-argument", "itemIds is invalid.");
  const itemIds = [...new Set(request.data.itemIds as string[])];
  const { meetup } = await requirePlanEditor(meetupId, uid);
  const existing = await meetup.ref.collection("planItems").get();
  if (itemIds.length !== existing.size || existing.docs.some((item) => !itemIds.includes(item.id))) throw new HttpsError("invalid-argument", "itemIds must include every plan item exactly once.");
  const batch = db.batch();
  itemIds.forEach((id, index) => batch.update(meetup.ref.collection("planItems").doc(id), { order: (index + 1) * 1000, updatedAt: FieldValue.serverTimestamp() }));
  await batch.commit();
  return { ok: true };
});

export const setPlanItemStatus = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const itemId = requireString(request.data?.itemId, "itemId", 128);
  const status = requirePlanItemStatus(request.data?.status);
  await requireParticipant(meetupId, uid);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  if (!meetup.exists || ["COMPLETED", "CANCELLED"].includes(meetup.data()?.status)) throw new HttpsError("failed-precondition", "Plan item status cannot be changed.");
  const item = meetup.ref.collection("planItems").doc(itemId);
  if (!(await item.get()).exists) throw new HttpsError("not-found", "Plan item not found.");
  await item.update({ status, ...(status === "completed" ? { completedAt: FieldValue.serverTimestamp(), completedByUid: uid } : { completedAt: FieldValue.delete(), completedByUid: FieldValue.delete() }), updatedAt: FieldValue.serverTimestamp() });
  return { status };
});

/** Completed meetups are retained as history; they are never copied to a second record. */
export const completeMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const snapshot = await meetup.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (["SCHEDULING", "CANCELLED"].includes(snapshot.data()?.status)) throw new HttpsError("failed-precondition", "Only a scheduled meetup can be completed.");
  await meetup.update({ status: "COMPLETED" satisfies MeetupStatus, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await deleteMeetupReminderJobs(meetupId);
  return { status: "COMPLETED" };
});

export const cancelMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const snapshot = await meetup.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (snapshot.data()?.status === "COMPLETED") throw new HttpsError("failed-precondition", "Completed meetups cannot be cancelled.");
  await meetup.update({ status: "CANCELLED" satisfies MeetupStatus, cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  await deleteMeetupReminderJobs(meetupId);
  return { status: "CANCELLED" };
});

/** Permanently removes a meetup and every nested vote, plan, route, and expense. */
export const deleteMeetup = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const [notifications, reminders, reminderPreferences] = await Promise.all([
    db.collection("departureNotifications").where("meetupId", "==", meetupId).get(),
    db.collection("meetupReminders").where("meetupId", "==", meetupId).get(),
    db.collection("meetupReminderPreferences").where("meetupId", "==", meetupId).get(),
  ]);
  await db.recursiveDelete(meetup);
  if (!notifications.empty || !reminders.empty || !reminderPreferences.empty) {
    const writer = db.bulkWriter();
    notifications.docs.forEach((notification) => writer.delete(notification.ref));
    reminders.docs.forEach((reminder) => writer.delete(reminder.ref));
    reminderPreferences.docs.forEach((preference) => writer.delete(preference.ref));
    await writer.close();
  }
  return { meetupId };
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
  // The host's explicit choice wins. Votes remain visible as decision support,
  // but a different, newly-ranked slot must never replace the one the host
  // selected on screen between a refresh and confirmation.
  const slotId = requireString(request.data?.slotId, "slotId", 128);
  await requireHost(meetupId, uid);
  const meetup = db.doc(`meetups/${meetupId}`);
  const confirmation = await db.runTransaction(async (transaction) => {
    const [meetupSnapshot, slotSnapshot] = await Promise.all([
      transaction.get(meetup),
      transaction.get(meetup.collection("candidateSlots").doc(slotId)),
    ]);
    if (!meetupSnapshot.exists) throw new HttpsError("not-found", "Meetup not found.");
    if (meetupSnapshot.data()?.status !== "SCHEDULING") {
      throw new HttpsError("failed-precondition", "The schedule has already been confirmed.");
    }
    if (!slotSnapshot.exists) throw new HttpsError("not-found", "Candidate slot not found.");
    const value = slotSnapshot.data()?.startDateTime as Timestamp | undefined;
    if (!(value instanceof Timestamp)) throw new HttpsError("failed-precondition", "Candidate slot is invalid.");
    const nextStatus: MeetupStatus = meetupSnapshot.data()?.meetingPlace
      ? "READY"
      : meetupSnapshot.data()?.collectOrigins === false
        ? "LOCATION_SELECTING"
        : "SCHEDULE_CONFIRMED";
    transaction.update(meetup, {
      status: nextStatus,
      confirmedDateTime: value,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {
      slotId,
      confirmedDateTime: value.toDate().toISOString(),
      status: nextStatus,
      meetupTitle: meetupSnapshot.data()?.title as string,
    };
  });
  await safelyReplaceMeetupReminderJobs(
    meetupId,
    confirmation.meetupTitle,
    new Date(confirmation.confirmedDateTime),
  );
  return {
    slotId: confirmation.slotId,
    confirmedDateTime: confirmation.confirmedDateTime,
    status: confirmation.status,
  };
});

/**
 * Lets the host revise a confirmed date/time. Meeting place and private
 * origins remain intact, while any legacy routes and departure notifications
 * are removed.
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
  if (previousStatus === "COMPLETED" || previousStatus === "CANCELLED") {
    throw new HttpsError("failed-precondition", "Completed or cancelled meetups cannot be changed.");
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
    ? "READY"
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
  await safelyReplaceMeetupReminderJobs(
    meetupId,
    meetupSnapshot.data()?.title as string,
    confirmedDate,
  );

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
  if (!meetup.exists || !meetupStatus || meetupStatus === "SCHEDULING" || meetupStatus === "COMPLETED" || meetupStatus === "CANCELLED") {
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

/** Loads fresh venue metadata on demand without storing changeable business data
 * in a meetup. All calls use the server-only Places key. */
export const getPlaceDetails = onCall(async (request) => {
  requireUid(request.auth?.uid);
  const placeId = requireString(request.data?.placeId, "placeId", 256);
  try {
    return { place: await getMapsProvider().getPlaceDetails(placeId) };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown Places API error.";
    console.error("getPlaceDetails failed", { message });
    if (message.startsWith("Google Places details request failed")) {
      throw new HttpsError("failed-precondition", "Google Places venue details are unavailable. Check the server key, billing, and Places API settings.");
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
  if (meetup.data()?.collectOrigins === false) {
    throw new HttpsError("failed-precondition", "The host has disabled origin collection for this meetup.");
  }
  const meetupStatus = meetup.data()?.status as MeetupStatus | undefined;
  if (!meetupStatus || meetupStatus === "COMPLETED" || meetupStatus === "CANCELLED") throw new HttpsError("failed-precondition", "Origins cannot be changed for a finished meetup.");
  const batch = db.batch();
  batch.set(db.doc(`meetups/${meetupId}/privateOrigins/${uid}`), { uid, origin, updatedAt: FieldValue.serverTimestamp() });
  batch.set(db.doc(`meetups/${meetupId}/participants/${uid}`), { hasOrigin: true, originArea: origin.name, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (meetupStatus === "SCHEDULE_CONFIRMED") batch.update(meetup.ref, { status: "LOCATION_COLLECTING" satisfies MeetupStatus, updatedAt: FieldValue.serverTimestamp() });
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
  const meetup = db.doc(`meetups/${meetupId}`);
  const snapshot = await meetup.get();
  const currentStatus = snapshot.data()?.status as MeetupStatus | undefined;
  if (!currentStatus || currentStatus === "COMPLETED" || currentStatus === "CANCELLED") throw new HttpsError("failed-precondition", "Meeting place selection is closed.");
  const nextStatus: MeetupStatus = currentStatus === "SCHEDULING" ? "SCHEDULING" : "LOCATION_SELECTING";
  await meetup.update({ status: nextStatus, updatedAt: FieldValue.serverTimestamp() });
  return { status: nextStatus };
});

export const getMeetingPointRecommendations = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const mode = requireMeetingPointMode(request.data?.mode ?? "FAIR");
  await requireParticipant(meetupId, uid);
  const origins = await participantOrigins(meetupId);
  if (origins.length < 2) throw new HttpsError("failed-precondition", "At least two participants need an origin first.");
  const [options, contentVotes] = await Promise.all([
    db.collection(`meetups/${meetupId}/contentOptions`).get(),
    db.collection(`meetups/${meetupId}/contentVotes`).get(),
  ]);
  const voteCounts = new Map<string, number>();
  contentVotes.docs.forEach((vote) => voteCounts.set(vote.data().optionId, (voteCounts.get(vote.data().optionId) ?? 0) + 1));
  const preferredLabels = options.docs
    .map((option) => ({ label: option.data().label as string, count: voteCounts.get(option.id) ?? 0 }))
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 2)
    .map((option) => option.label);
  const provider = getMapsProvider();
  try {
    const center = geographicCenter(origins.map((item) => item.origin));
    // When content voting is active, look for actual places matching the most
    // popular food/activity choice near the fair geographic center.
    const candidates = preferredLabels.length > 0
      ? await provider.searchPlaces(preferredLabels.join(" "), center)
      : await provider.candidatePlaces(center);
    const matrix = await provider.calculateMatrix(origins.map((item) => item.origin), candidates);
    return { mode, contentPreferences: preferredLabels, candidates: rankMeetingPoints(candidates, matrix.durations, origins.map((item) => item.uid), mode).slice(0, 3) };
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
  const currentStatus = snapshot.data()?.status as MeetupStatus | undefined;
  if (!currentStatus || currentStatus === "COMPLETED" || currentStatus === "CANCELLED") throw new HttpsError("failed-precondition", "Meeting place selection is closed.");
  // Departure/arrival-time calculation is intentionally disabled for now, so
  // confirming a place finishes the planning flow without a route step.
  await meetup.update({
    meetingPlace,
    status: (currentStatus === "SCHEDULING" ? "SCHEDULING" : "READY") satisfies MeetupStatus,
    targetArrivalTime: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { meetingPlace };
});

export const calculateRoutes = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  await requireParticipant(meetupId, uid);
  if (!DEPARTURE_TIME_FEATURE_ENABLED) {
    throw new HttpsError("failed-precondition", "Departure and arrival time calculation is temporarily disabled.");
  }
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  const data = meetup.data();
  if (!meetup.exists || !data?.meetingPlace || !data.confirmedDateTime) throw new HttpsError("failed-precondition", "Meeting place and date must be confirmed first.");
  const meetingPlace = data.meetingPlace as Location;
  const targetArrival = new Date((data.confirmedDateTime as Timestamp).toDate().getTime() - (data.arrivalBufferMinutes ?? 10) * 60_000);
  const origins = await participantOrigins(meetupId);
  const provider = getMapsProvider();
  const batch = db.batch();
  let routes: Array<{ participantUid: string; originName: string; destinationName: string; durationMinutes: number; transfers: number; routeSummary: string; isEstimate: boolean; externalMapsUrl: string; departureTime: string; arrivalTime: string }>;
  try {
    routes = await Promise.all(origins.map(async ({ uid: participantUid, origin }) => {
      // Transit routing accepts an arrival time, so every participant's route is
      // calculated to reach the meeting point by the shared target arrival.
      const route = await provider.calculateRoute(origin, meetingPlace, targetArrival);
      const departureTime = new Date(targetArrival.getTime() - route.durationMinutes * 60_000);
      const item = { participantUid, originName: origin.name, destinationName: meetingPlace.name, durationMinutes: route.durationMinutes, transfers: route.transfers ?? 0, routeSummary: route.routeSummary ?? `${origin.name} → ${meetingPlace.name}`, isEstimate: route.isEstimate === true, externalMapsUrl: mapsUrl(origin, meetingPlace), departureTime: departureTime.toISOString(), arrivalTime: targetArrival.toISOString() };
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

/** Enables or disables date reminders for the caller on one meetup. */
export const setMeetupReminderPreference = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const enabled = requireBoolean(request.data?.enabled, "enabled", false);
  const locale = request.data?.locale === "ko" ? "ko" : "ja";
  const participant = await requireParticipant(meetupId, uid);
  const meetup = await db.doc(`meetups/${meetupId}`).get();
  if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
  const data = meetup.data();
  const confirmedDateTime = data?.confirmedDateTime as Timestamp | undefined;
  if (enabled && !(confirmedDateTime instanceof Timestamp)) {
    throw new HttpsError("failed-precondition", "Confirm a schedule before enabling reminders.");
  }
  if (enabled && confirmedDateTime!.toMillis() <= Date.now()) {
    throw new HttpsError("failed-precondition", "Reminders are only available for upcoming meetups.");
  }

  if (enabled) {
    const token = requireString(request.data?.token, "token", 4096);
    await savePushToken(uid, token, request.data?.platform);
  }

  await db.doc(`meetupReminderPreferences/${meetupId}_${uid}`).set({
    meetupId,
    uid,
    enabled,
    locale,
    minutesBefore: [...MEETUP_REMINDER_MINUTES],
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await participant.ref.set({
    remindersEnabled: enabled,
    reminderMinutesBefore: enabled ? [...MEETUP_REMINDER_MINUTES] : FieldValue.delete(),
    remindersUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const scheduledCount = await replaceUserMeetupReminderJobs(
    meetupId,
    uid,
    data?.title as string,
    confirmedDateTime?.toDate() ?? new Date(0),
    locale,
    enabled,
  );
  return { enabled, scheduledCount, minutesBefore: [...MEETUP_REMINDER_MINUTES] };
});

/** Keeps the signed-in user's current device token fresh after FCM rotates it. */
export const registerPushToken = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const token = requireString(request.data?.token, "token", 4096);
  await savePushToken(uid, token, request.data?.platform);
  return { registered: true };
});

/** Registers the caller's current device for their own calculated departure. */
export const registerDeviceToken = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const meetupId = requireString(request.data?.meetupId, "meetupId", 128);
  const token = requireString(request.data?.token, "token", 4096);
  await requireParticipant(meetupId, uid);
  await savePushToken(uid, token, request.data?.platform);

  return { registered: true };
});

/** Delivers due departure reminders. Deploying this function requires Cloud Scheduler. */
export const sendDepartureNotifications = onSchedule("every 1 minutes", async () => {
  if (!DEPARTURE_TIME_FEATURE_ENABLED) return;
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

/** Delivers opt-in reminders independently from the disabled route feature. */
export const sendMeetupReminders = onSchedule("every 1 minutes", async () => {
  const due = await db.collection("meetupReminders")
    .where("status", "==", "PENDING")
    .where("sendAt", "<=", Timestamp.now())
    .limit(100)
    .get();

  await Promise.all(due.docs.map(async (reminder) => {
    const job = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(reminder.ref);
      const data = current.data();
      if (!current.exists || data?.status !== "PENDING" ||
          !(data.sendAt instanceof Timestamp) || data.sendAt.toMillis() > Date.now()) return null;
      transaction.update(reminder.ref, {
        status: "SENDING",
        attempts: (data.attempts ?? 0) + 1,
        claimedAt: FieldValue.serverTimestamp(),
      });
      return data;
    });
    if (!job) return;

    try {
      const [device, meetup] = await Promise.all([
        db.doc(`users/${job.uid as string}/devices/default`).get(),
        db.doc(`meetups/${job.meetupId as string}`).get(),
      ]);
      const token = device.data()?.token;
      const meetupData = meetup.data();
      const confirmedDateTime = meetupData?.confirmedDateTime as Timestamp | undefined;
      const expectedMeetupAt = job.meetupAt as Timestamp | undefined;
      if (!meetup.exists || ["COMPLETED", "CANCELLED"].includes(meetupData?.status) ||
          !(confirmedDateTime instanceof Timestamp) || !(expectedMeetupAt instanceof Timestamp) ||
          confirmedDateTime.toMillis() !== expectedMeetupAt.toMillis()) {
        await reminder.ref.update({ status: "CANCELLED", updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      if (typeof token !== "string" || token.length === 0) {
        await reminder.ref.update({ status: "NO_DEVICE", updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      const copy = meetupReminderCopy(
        job.locale as string,
        job.meetupTitle as string,
        job.minutesBefore as number,
      );
      await getMessaging().send({
        token,
        notification: copy,
        data: { meetupId: job.meetupId as string, type: "meetup-reminder" },
        android: { notification: { sound: "default" } },
        apns: { payload: { aps: { sound: "default" } } },
      });
      await reminder.ref.update({
        status: "SENT",
        sentAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const attempts = (job.attempts ?? 0) + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown FCM error";
      const invalidToken = /registration-token-not-registered|invalid-registration-token/.test(message);
      await reminder.ref.update({
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
  const profile = db.doc(`users/${uid}`);
  const existing = await profile.get();
  const becameRegistered = accountType === "REGISTERED" && existing.data()?.accountType !== "REGISTERED";
  await profile.set({
    uid,
    displayName,
    accountType,
    updatedAt: FieldValue.serverTimestamp(),
    ...(!existing.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
  }, { merge: true });
  // Historical relationship backfill is needed only on the one-time account
  // upgrade, not on every login and profile visit.
  if (becameRegistered) {
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
  const [participant, profile, participants] = await Promise.all([
    db.doc(`meetups/${meetupId}/participants/${uid}`).get(),
    db.doc(`users/${uid}`).get(),
    db.collection(`meetups/${meetupId}/participants`).get(),
  ]);
  if (!participant.exists) throw new HttpsError("permission-denied", "You are not a meetup participant.");
  if (profile.data()?.accountType !== "REGISTERED") return { relationships: [] };
  const relationshipRefs = participants.docs
    .filter((participant) => participant.id !== uid)
    .map((participant) => db.doc(`users/${uid}/relationships/${participant.id}`));
  const relationships = relationshipRefs.length > 0 ? await db.getAll(...relationshipRefs) : [];
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
  const [profile, relationships] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collection(`users/${uid}/relationships`).orderBy("lastMeetupAt", "desc").limit(100).get(),
  ]);
  if (profile.data()?.accountType !== "REGISTERED") return { relationships: [] };
  return {
    relationships: relationships.docs.map((relationship) => ({
      otherUid: relationship.id,
      displayName: relationship.data().displayName ?? "aimasho user",
      sharedMeetupCount: relationship.data().sharedMeetupCount ?? 0,
      lastMeetupId: relationship.data().lastMeetupId ?? null,
    })),
  };
});

/** Returns the events two registered users shared, including completed history. */
export const getFriendHistory = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const otherUid = requireString(request.data?.otherUid, "otherUid", 128);
  const [profile, relationship, participations] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${uid}/relationships/${otherUid}`).get(),
    db.collectionGroup("participants").where("uid", "==", uid).limit(150).get(),
  ]);
  if (profile.data()?.accountType !== "REGISTERED") throw new HttpsError("failed-precondition", "Create an account to view friend history.");
  if (!relationship.exists) throw new HttpsError("not-found", "Friend relationship not found.");
  const ownAvailable = new Map(participations.docs.map((participant) => [participant.ref.parent.parent?.id, participant.data().confirmedScheduleAvailability !== "NO"]));
  const candidates = await Promise.all(participations.docs.map(async (participant) => participant.ref.parent.parent?.get()));
  const shared = await Promise.all(candidates.filter((meetup): meetup is DocumentSnapshot => Boolean(meetup?.exists)).map(async (meetup) => ({ meetup, other: await meetup.ref.collection("participants").doc(otherUid).get() })));
  const histories = await Promise.all(shared.filter(({ meetup, other }) => other.exists && ownAvailable.get(meetup.id) && other.data()?.confirmedScheduleAvailability !== "NO").map(({ meetup }) => historyMeetupPayload(meetup)));
  histories.sort((a, b) => (b.completedAt ?? b.confirmedDateTime ?? "").localeCompare(a.completedAt ?? a.confirmedDateTime ?? ""));
  return {
    otherUid,
    displayName: relationship.data()?.displayName ?? "aimasho user",
    completedMeetupCount: histories.filter((meetup) => meetup.status === "COMPLETED").length,
    meetups: histories,
    stops: travelTimelineStops(histories),
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

/** Deletes only the group. Existing meetup history is preserved ungrouped. */
export const deleteRoom = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const roomId = requireString(request.data?.roomId, "roomId", 128);
  const room = db.doc(`rooms/${roomId}`);
  const snapshot = await room.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Room not found.");
  if (snapshot.data()?.ownerUid !== uid) throw new HttpsError("permission-denied", "Only the Room owner can delete it.");
  const meetups = await db.collection("meetups").where("roomId", "==", roomId).get();
  if (!meetups.empty) {
    const writer = db.bulkWriter();
    meetups.docs.forEach((meetup) => writer.update(meetup.ref, { roomId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }));
    await writer.close();
  }
  await db.recursiveDelete(room);
  return { roomId, preservedMeetupCount: meetups.size };
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
  if (request.auth?.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("failed-precondition", "Create an account to use Rooms.");
  const [profile, memberships] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.collectionGroup("members").where("uid", "==", uid).get(),
  ]);
  if (profile.data()?.accountType !== "REGISTERED") throw new HttpsError("failed-precondition", "Create an account to use Rooms.");
  const rooms = await Promise.all(memberships.docs.map(async (membership) => {
    const room = await membership.ref.parent.parent?.get();
    return room?.exists ? { id: room.id, name: room.data()?.name, inviteCode: room.data()?.inviteCode, role: membership.data().role } : null;
  }));
  return { rooms: rooms.filter((room): room is NonNullable<typeof room> => room !== null) };
});

async function dashboardCollectionGroupDocs(collectionGroup: "participants" | "members", uid: string, limit: number) {
  try {
    return (await db.collectionGroup(collectionGroup).where("uid", "==", uid).limit(limit).get()).docs;
  } catch (caught) {
    const code = typeof caught === "object" && caught && "code" in caught ? Number(caught.code) : undefined;
    if (code !== 9) throw caught;
    // Single-field collection-group indexes can briefly be unavailable during
    // a deploy. Keep the signed-in home usable while Firestore finishes them.
    console.warn("Dashboard collection-group index is not ready", { collectionGroup, uid });
    return [];
  }
}

/** One read model for the signed-in home calendar, timeline, friends, and groups. */
export const getMyDashboard = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  if (request.auth?.token.firebase?.sign_in_provider === "anonymous") throw new HttpsError("failed-precondition", "Create an account to use the dashboard.");
  const [profile, participationDocs, relationships, membershipDocs, ownedMeetups] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    dashboardCollectionGroupDocs("participants", uid, 100),
    db.collection(`users/${uid}/relationships`).orderBy("lastMeetupAt", "desc").limit(50).get(),
    dashboardCollectionGroupDocs("members", uid, 50),
    db.collection("meetups").where("createdByUid", "==", uid).limit(100).get(),
  ]);
  if (profile.data()?.accountType !== "REGISTERED") throw new HttpsError("failed-precondition", "Create an account to use the dashboard.");
  const participantMeetupRefs = [...new Map(participationDocs.flatMap((participation) => {
    const ref = participation.ref.parent.parent;
    return ref ? [[ref.path, ref] as const] : [];
  })).values()];
  const meetupSnapshots = participantMeetupRefs.length > 0 ? await db.getAll(...participantMeetupRefs) : [];
  const uniqueMeetups = new Map<string, DocumentSnapshot>();
  ownedMeetups.docs.forEach((meetup) => uniqueMeetups.set(meetup.id, meetup));
  meetupSnapshots.forEach((meetup) => { if (meetup.exists) uniqueMeetups.set(meetup.id, meetup); });
  const histories = await Promise.all(
    [...uniqueMeetups.values()].map((snapshot) => dashboardMeetupPayload(snapshot, uid)),
  );

  const memberRoomRefs = [...new Map(membershipDocs.flatMap((membership) => {
    const ref = membership.ref.parent.parent;
    return ref ? [[ref.path, ref] as const] : [];
  })).values()];
  const roomSnapshots = memberRoomRefs.length > 0 ? await db.getAll(...memberRoomRefs) : [];
  const roomById = new Map(roomSnapshots.filter((room) => room.exists).map((room) => [room.id, room]));
  const completedByRoom = new Map<string, number>();
  histories.filter((meetup) => meetup.status === "COMPLETED" && meetup.roomId).forEach((meetup) => completedByRoom.set(meetup.roomId!, (completedByRoom.get(meetup.roomId!) ?? 0) + 1));
  const nextByRoom = new Map<string, string>();
  histories.filter((meetup) => !["COMPLETED", "CANCELLED"].includes(meetup.status) && meetup.roomId).forEach((meetup) => {
    const date = meetup.confirmedDateTime ?? meetup.candidateDateTimes[0];
    if (date && (!nextByRoom.get(meetup.roomId!) || date < nextByRoom.get(meetup.roomId!)!)) nextByRoom.set(meetup.roomId!, date);
  });
  const rooms = membershipDocs.flatMap((membership) => {
    const room = membership.ref.parent.parent ? roomById.get(membership.ref.parent.parent.id) : undefined;
    return room ? [{
      id: room.id,
      name: room.data()?.name ?? "aimasho group",
      inviteCode: room.data()?.inviteCode ?? "",
      role: membership.data().role,
      completedMeetupCount: completedByRoom.get(room.id) ?? 0,
      nextMeetupDate: nextByRoom.get(room.id) ?? null,
    }] : [];
  });
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));
  const meetups = histories.map((meetup) => ({ ...meetup, roomName: meetup.roomId ? roomNames.get(meetup.roomId) ?? null : null }));
  meetups.sort((first, second) => {
    const firstPast = ["COMPLETED", "CANCELLED"].includes(first.status);
    const secondPast = ["COMPLETED", "CANCELLED"].includes(second.status);
    if (firstPast !== secondPast) return firstPast ? 1 : -1;
    return firstPast ? historyDate(second).localeCompare(historyDate(first)) : historyDate(first).localeCompare(historyDate(second));
  });

  return {
    displayName: profile.data()?.displayName ?? request.auth?.token.name ?? "aimasho user",
    meetups,
    relationships: relationships.docs.map((relationship) => ({
      otherUid: relationship.id,
      displayName: relationship.data().displayName ?? "aimasho user",
      sharedMeetupCount: relationship.data().sharedMeetupCount ?? 0,
      lastMeetupId: relationship.data().lastMeetupId ?? null,
    })),
    rooms,
    summary: {
      upcomingMeetupCount: histories.filter((meetup) => !["COMPLETED", "CANCELLED"].includes(meetup.status)).length,
      completedMeetupCount: histories.filter((meetup) => meetup.status === "COMPLETED").length,
      friendCount: relationships.size,
      groupCount: rooms.length,
    },
  };
});

/**
 * Lazy read model for the Journey player. Keeping this separate prevents the
 * signed-in home from paying for completed plan-item reads on every visit.
 */
export const getMyTravelTimeline = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  if (request.auth?.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("failed-precondition", "Create an account to view your journey.");
  }
  const [profile, participationDocs] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    dashboardCollectionGroupDocs("participants", uid, 150),
  ]);
  if (profile.data()?.accountType !== "REGISTERED") {
    throw new HttpsError("failed-precondition", "Create an account to view your journey.");
  }
  const refs = [...new Map(participationDocs.filter((participation) => participation.data().confirmedScheduleAvailability !== "NO").flatMap((participation) => {
    const ref = participation.ref.parent.parent;
    return ref ? [[ref.path, ref] as const] : [];
  })).values()];
  const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
  const completed = snapshots.filter((snapshot) =>
    snapshot.exists && snapshot.data()?.status === "COMPLETED"
  );
  const histories = await Promise.all(completed.map(historyMeetupPayload));
  const stops = travelTimelineStops(histories);
  return {
    stops,
    summary: {
      completedMeetupCount: histories.length,
      uniquePlaceCount: new Set(stops.map((stop) => stop.place.placeId)).size,
      totalStops: stops.length,
    },
  };
});

export const getRoomDetail = onCall(async (request) => {
  const uid = requireUid(request.auth?.uid);
  const roomId = requireString(request.data?.roomId, "roomId", 128);
  const roomRef = db.doc(`rooms/${roomId}`);
  const [room, membership] = await Promise.all([
    roomRef.get(),
    roomRef.collection("members").doc(uid).get(),
  ]);
  if (!room.exists) throw new HttpsError("not-found", "Room not found.");
  if (!membership.exists) throw new HttpsError("permission-denied", "You are not a Room member.");
  const [members, meetups] = await Promise.all([room.ref.collection("members").get(), db.collection("meetups").where("roomId", "==", roomId).limit(150).get()]);
  const history = await Promise.all(meetups.docs.map((meetup) => historyMeetupPayload(meetup)));
  history.sort((a, b) => (b.completedAt ?? b.confirmedDateTime ?? "").localeCompare(a.completedAt ?? a.confirmedDateTime ?? ""));
  const completed = history.filter((meetup) => meetup.status === "COMPLETED");
  const mapPlaces = mapPlaceVisits(history);
  const completedChronologically = [...completed].sort((a, b) => (a.completedAt ?? a.confirmedDateTime ?? "").localeCompare(b.completedAt ?? b.confirmedDateTime ?? ""));
  const occurrenceById = new Map(completedChronologically.map((meetup, index) => [meetup.id, index + 1]));
  return {
    room: { id: room.id, name: room.data()?.name, inviteCode: room.data()?.inviteCode, ownerUid: room.data()?.ownerUid },
    members: members.docs.map((member) => member.data()),
    meetups: history.map((meetup) => ({ ...meetup, occurrence: occurrenceById.get(meetup.id) ?? null })),
    summary: { completedMeetupCount: completed.length, uniquePlaceCount: mapPlaces.length, mostVisitedPlace: mapPlaces[0] ?? null },
    mapPlaces,
  };
});
