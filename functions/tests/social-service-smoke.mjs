// Real Firestore reads and transactions, with callable auth contexts, in a demo emulator.
import assert from "node:assert/strict";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8187";
process.env.GCLOUD_PROJECT = "demo-social-planning";
const { initializeApp, deleteApp } = await import("firebase-admin/app");
const { getFirestore, Timestamp } = await import("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-social-planning" });
const api = await import("../lib/social/service.js");
const db = getFirestore(app);
const context = (uid, data = {}, provider = "google.com") => ({ auth: { uid, token: { firebase: { sign_in_provider: provider } } }, data });
const root = "social-smoke";
const me = `${root}-me`, friend = `${root}-friend`, guest = `${root}-guest`;
const batch = db.batch();
for (const [uid, type] of [[me, "REGISTERED"], [friend, "REGISTERED"], [guest, "ANONYMOUS"]]) {
  batch.set(db.doc(`users/${uid}`), { accountType: type, displayName: uid });
}
for (const [id, status] of [["completed", "COMPLETED"], ["pending", "SCHEDULING"], ["cancelled", "CANCELLED"]]) {
  const ref = db.doc(`meetups/${root}-${id}`);
  batch.set(ref, { title: id, status, createdByUid: me, updatedAt: Timestamp.now(), ...(status === "COMPLETED" ? { completedAt: Timestamp.now() } : {}) });
  for (const uid of [me, friend, guest]) batch.set(ref.collection("participants").doc(uid), { uid, displayName: uid, confirmedScheduleAvailability: "YES" });
}
await batch.commit();
try {
  const overview = await api.getMySocialOverview.run(context(me));
  assert.equal(overview.friends.length, 1);
  assert.equal(overview.friends[0].completedCount, 1);
  assert.equal(overview.friends[0].plannedCount, 1);
  assert.equal(overview.memories.length, 1);
  const guests = await api.getMyMeetups.run(context(guest, {}, "anonymous"));
  assert.equal(guests.meetups.length, 3);
  assert(guests.meetups.some((meetup) => meetup.status === "SCHEDULING"));
  const meetupId = `${root}-completed`;
  await api.saveMeetupMemory.run(context(me, { meetupId, body: "우리의 첫 기록" }));
  const notes = await api.getMeetupMemories.run(context(friend, { meetupId }));
  assert.equal(notes.notes[0].body, "우리의 첫 기록");
  assert.equal(notes.notes[0].uid, me);
  await assert.rejects(api.getMeetupMemories.run(context("outsider", { meetupId })), { code: "permission-denied" });
  await assert.rejects(api.saveMeetupMemory.run(context(guest, { meetupId, body: "no" }, "anonymous")), { code: "failed-precondition" });
  await api.saveMeetupMemory.run(context(me, { meetupId, body: "수정한 기록" }));
  assert.equal((await api.getMeetupMemories.run(context(me, { meetupId }))).notes.length, 1);
  await api.deleteMeetupMemory.run(context(me, { meetupId }));
  assert.equal((await api.getMeetupMemories.run(context(friend, { meetupId }))).notes.length, 0);
  console.log("Social read models + memory create/read/update/delete + access denials passed against demo Firestore.");
} finally { await deleteApp(app); }
