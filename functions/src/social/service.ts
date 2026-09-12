import { getFirestore, FieldValue, type DocumentSnapshot } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { dashboardMeetupPayload, timestampIso } from "../dashboard/history.js";
import { requireString } from "../shared/validation.js";
import { buildSocialOverview, type SocialEvent } from "./overview.js";

function meetupIdentifier(value: unknown) {
  const id = requireString(value, "meetupId", 128);
  if (id.includes("/")) throw new HttpsError("invalid-argument", "Invalid meetup ID.");
  return id;
}

function authenticated(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  return uid;
}

async function registered(uid: string, provider?: string) {
  const profile = await getFirestore().doc(`users/${uid}`).get();
  if (provider === "anonymous" || profile.data()?.accountType !== "REGISTERED") {
    throw new HttpsError("failed-precondition", "Create an account to keep shared memories.");
  }
  return profile;
}

/** Bounded reads; expose truncation rather than presenting partial counts as lifetime totals. */
async function ownMeetups(uid: string) {
  const db = getFirestore();
  const [memberships, owned] = await Promise.all([
    db.collectionGroup("participants").where("uid", "==", uid).limit(151).get(),
    db.collection("meetups").where("createdByUid", "==", uid).limit(151).get(),
  ]);
  const refs = memberships.docs.slice(0, 150).flatMap((doc) => doc.ref.parent.parent ? [doc.ref.parent.parent] : []);
  const snapshots = refs.length ? await db.getAll(...refs) : [];
  const unique = new Map<string, DocumentSnapshot>();
  [...owned.docs.slice(0, 150), ...snapshots].forEach((snapshot) => {
    if (snapshot.exists && snapshot.ref.parent.id === "meetups") unique.set(snapshot.id, snapshot);
  });
  const sorted = [...unique.values()].sort((a, b) => {
    const date = (snapshot: DocumentSnapshot) => timestampIso(snapshot.data()?.updatedAt) ?? timestampIso(snapshot.data()?.createdAt) ?? "";
    return date(b).localeCompare(date(a));
  });
  return { snapshots: sorted, limited: memberships.size > 150 || owned.size > 150 };
}

export const getMyMeetups = onCall({ region: "asia-northeast1", maxInstances: 10 }, async (request) => {
  const uid = authenticated(request.auth?.uid);
  const { snapshots, limited } = await ownMeetups(uid);
  const meetups = await Promise.all(snapshots.map((snapshot) => dashboardMeetupPayload(snapshot, uid)));
  return { meetups, limited };
});

export const getMySocialOverview = onCall({ region: "asia-northeast1", maxInstances: 10 }, async (request) => {
  const uid = authenticated(request.auth?.uid);
  await registered(uid, request.auth?.token.firebase?.sign_in_provider);
  const db = getFirestore();
  const { snapshots, limited } = await ownMeetups(uid);
  const participantSets = await Promise.all(snapshots.map((snapshot) => snapshot.ref.collection("participants").get()));
  const uids = [...new Set(participantSets.flatMap((set) => set.docs.map((doc) => doc.id)))];
  const profiles: DocumentSnapshot[] = [];
  for (let offset = 0; offset < uids.length; offset += 200) {
    profiles.push(...await db.getAll(...uids.slice(offset, offset + 200).map((id) => db.doc(`users/${id}`))));
  }
  const registeredIds = new Set(profiles.filter((profile) => profile.data()?.accountType === "REGISTERED").map((profile) => profile.id));
  const events: SocialEvent[] = snapshots.map((snapshot, index) => {
    const data = snapshot.data();
    return {
      id: snapshot.id, title: data?.title ?? "aimasho", status: data?.status ?? "SCHEDULING",
      date: timestampIso(data?.confirmedDateTime) ?? timestampIso(data?.completedAt),
      placeName: data?.meetingPlace?.name ?? null,
      participants: participantSets[index].docs.map((doc) => ({
        uid: doc.id, displayName: doc.data().displayName ?? "aimasho",
        registered: registeredIds.has(doc.id), availability: doc.data().confirmedScheduleAvailability,
      })),
    };
  });
  return { ...buildSocialOverview(uid, events), limited };
});

async function memoryAccess(uid: string, meetupId: string) {
  const ref = getFirestore().doc(`meetups/${meetupId}`);
  const [meetup, member] = await Promise.all([ref.get(), ref.collection("participants").doc(uid).get()]);
  if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
  if (!member.exists) throw new HttpsError("permission-denied", "Members only.");
  return { ref, meetup, member };
}

export const getMeetupMemories = onCall({ region: "asia-northeast1", maxInstances: 10 }, async (request) => {
  const uid = authenticated(request.auth?.uid);
  const meetupId = meetupIdentifier(request.data?.meetupId);
  const { ref } = await memoryAccess(uid, meetupId);
  const notes = await ref.collection("memories").orderBy("updatedAt", "desc").limit(100).get();
  return { notes: notes.docs.map((doc) => ({
    uid: doc.id, displayName: doc.data().displayName, body: doc.data().body,
    updatedAt: timestampIso(doc.data().updatedAt),
  })) };
});

export const saveMeetupMemory = onCall({ region: "asia-northeast1", maxInstances: 10 }, async (request) => {
  const uid = authenticated(request.auth?.uid);
  const meetupId = meetupIdentifier(request.data?.meetupId);
  const body = requireString(request.data?.body, "body", 280);
  const profile = await registered(uid, request.auth?.token.firebase?.sign_in_provider);
  const db = getFirestore();
  const ref = db.doc(`meetups/${meetupId}`);
  await db.runTransaction(async (transaction) => {
    const [meetup, member] = await transaction.getAll(ref, ref.collection("participants").doc(uid));
    if (!meetup.exists) throw new HttpsError("not-found", "Meetup not found.");
    if (!member.exists || member.data()?.confirmedScheduleAvailability === "NO") throw new HttpsError("permission-denied", "Participating members only.");
    if (meetup.data()?.status !== "COMPLETED") throw new HttpsError("failed-precondition", "Complete the meetup first.");
    transaction.set(ref.collection("memories").doc(uid), {
      uid, displayName: profile.data()?.displayName ?? member.data()?.displayName ?? "aimasho",
      body, updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

export const deleteMeetupMemory = onCall({ region: "asia-northeast1", maxInstances: 10 }, async (request) => {
  const uid = authenticated(request.auth?.uid);
  const meetupId = meetupIdentifier(request.data?.meetupId);
  const { ref } = await memoryAccess(uid, meetupId);
  // The caller can only delete their own note, never another participant's.
  await ref.collection("memories").doc(uid).delete();
  return { ok: true };
});
