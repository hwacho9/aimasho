import {
  FieldValue,
  getFirestore,
  type Firestore,
} from "firebase-admin/firestore";

interface RegisteredParticipant {
  uid: string;
  displayName: string;
}

export function relationshipPairId(firstUid: string, secondUid: string): string {
  return Buffer.from([firstUid, secondUid].sort().join("\u0000")).toString("base64url");
}

async function registeredParticipants(
  db: Firestore,
  meetupId: string,
): Promise<RegisteredParticipant[]> {
  const participants = await db.collection(`meetups/${meetupId}/participants`).get();
  if (participants.empty) return [];
  const profiles = await db.getAll(
    ...participants.docs.map((participant) => db.doc(`users/${participant.id}`)),
  );
  const profilesByUid = new Map(
    profiles
      .filter((profile) => profile.data()?.accountType === "REGISTERED")
      .map((profile) => [profile.id, profile.data()]),
  );
  return participants.docs.flatMap((participant) => {
    const profile = profilesByUid.get(participant.id);
    return profile
      ? [{
        uid: participant.id,
        displayName: profile.displayName
          ?? participant.data().displayName
          ?? "aimasho user",
      }]
      : [];
  });
}

async function recordRelationshipPair(
  db: Firestore,
  meetupId: string,
  first: RegisteredParticipant,
  second: RegisteredParticipant,
): Promise<void> {
  if (first.uid === second.uid) return;
  const pairId = relationshipPairId(first.uid, second.uid);
  const pair = db.doc(`meetups/${meetupId}/relationshipPairs/${pairId}`);
  const firstRelationship = db.doc(`users/${first.uid}/relationships/${second.uid}`);
  const secondRelationship = db.doc(`users/${second.uid}/relationships/${first.uid}`);
  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(pair)).exists) return;
    transaction.set(pair, {
      participantUids: [first.uid, second.uid].sort(),
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(firstRelationship, {
      otherUid: second.uid,
      displayName: second.displayName,
      sharedMeetupCount: FieldValue.increment(1),
      lastMeetupId: meetupId,
      lastMeetupAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(secondRelationship, {
      otherUid: first.uid,
      displayName: first.displayName,
      sharedMeetupCount: FieldValue.increment(1),
      lastMeetupId: meetupId,
      lastMeetupAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function recordRelationshipsForMeetupWithDb(
  db: Firestore,
  meetupId: string,
  onlyForUid?: string,
): Promise<void> {
  const participants = await registeredParticipants(db, meetupId);
  const pairs = onlyForUid
    ? participants
      .filter((participant) => participant.uid === onlyForUid)
      .flatMap((participant) => participants
        .filter((other) => other.uid !== participant.uid)
        .map((other) => [participant, other] as const))
    : participants.flatMap((participant, index) => participants
      .slice(index + 1)
      .map((other) => [participant, other] as const));
  await Promise.all(
    pairs.map(([first, second]) => recordRelationshipPair(
      db,
      meetupId,
      first,
      second,
    )),
  );
}

/** Records each registered pair once per meetup. */
export async function recordRelationshipsForMeetup(
  meetupId: string,
  onlyForUid?: string,
): Promise<void> {
  await recordRelationshipsForMeetupWithDb(getFirestore(), meetupId, onlyForUid);
}

export async function recordRelationshipsForRegisteredUser(uid: string): Promise<void> {
  const db = getFirestore();
  const participations = await db
    .collectionGroup("participants")
    .where("uid", "==", uid)
    .get();
  const meetupIds = new Set(
    participations.docs
      .map((participation) => participation.ref.parent.parent?.id)
      .filter((meetupId): meetupId is string => Boolean(meetupId)),
  );
  await Promise.all(
    [...meetupIds].map((meetupId) => recordRelationshipsForMeetupWithDb(
      db,
      meetupId,
      uid,
    )),
  );
}
