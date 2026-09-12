// Real Auth -> callable HTTP -> Firestore flow. No Admin SDK, fixtures or mocks
// replace the application services. All writes are confined to a demo emulator.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const project = 'demo-aimasho-e2e';
const origin = `http://127.0.0.1:5001/${project}/asia-northeast1`;
const run = randomUUID().slice(0, 8);
const timings = [];
async function json(url, body, token) {
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  return response.json();
}
async function call(user, name, data = {}) {
  const start = performance.now();
  const result = await json(`${origin}/${name}`, { data }, user?.token);
  timings.push({ name, ms: Math.round(performance.now() - start) });
  if (result.error) throw Object.assign(new Error(`${name}: ${result.error.status}`), { code: result.error.status });
  return result.result;
}
async function account(name, anonymous = false) {
  const result = await json('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-test-key', {
    returnSecureToken: true,
    ...(!anonymous ? { email: `e2e-${run}-${name}@example.test`, password: `local-only-${randomUUID()}` } : {}),
  });
  assert(result.idToken, 'Auth emulator must be running');
  const user = { uid: result.localId, token: result.idToken, name };
  await call(user, 'saveProfile', { displayName: name });
  return user;
}
const check = (name) => console.log(`PASS ${name}`);
const a = await account(`A-${run}`), b = await account(`B-${run}`);
const outsider = await account(`outsider-${run}`), guest = await account(`guest-${run}`, true);
assert.equal((await call(a, 'getMySocialOverview')).friends.length, 0);
check('Registered accounts start with an empty friend list (not a load error)');

const create = (user, title) => call(user, 'createMeetup', {
  title: `E2E ${run} ${title}`, displayName: user.name, description: '',
  durationMinutes: 120, collectOrigins: false, allowPlanEditing: true,
  candidateSlots: ['2026-09-20T03:00:00Z', '2026-09-21T03:00:00Z'],
});
const { meetupId } = await create(a, 'shared');
const privateMeeting = await create(b, 'private');
assert((await call(a, 'getMyMeetups')).meetups.some(m => m.id === meetupId && m.status === 'SCHEDULING'));
const preview = await call(b, 'getMeetupInvitePreview', { meetupId });
assert.equal(preview.isAlreadyParticipant, false);
await call(b, 'joinMeetup', { meetupId, displayName: b.name });
await call(guest, 'joinMeetup', { meetupId, displayName: guest.name });
await call(b, 'joinMeetup', { meetupId, displayName: b.name });
assert.equal((await call(b, 'getMeetupInvitePreview', { meetupId })).isAlreadyParticipant, true);
for (const [user, peer] of [[a, b], [b, a]]) {
  const social = await call(user, 'getMySocialOverview');
  assert.equal(social.friends.length, 1, 'Guests must not become registered friends');
  assert.equal(social.friends[0].uid, peer.uid);
  assert.equal(social.friends[0].plannedCount, 1);
  assert.equal(social.friends[0].completedCount, 0);
}
check('Invite/join/revisit creates reciprocal connections without duplicate members; guest excluded');

const ranking = await call(a, 'calculateScheduleRecommendation', { meetupId });
const slotId = ranking.ranking[0].id;
await call(b, 'upsertVote', { meetupId, slotId, status: 'MAYBE' });
await call(b, 'upsertVote', { meetupId, slotId, status: 'YES' });
assert.equal((await call(a, 'calculateScheduleRecommendation', { meetupId })).ranking.find(s => s.id === slotId).yes, 1);
await assert.rejects(call(b, 'confirmSchedule', { meetupId, slotId }), { code: 'PERMISSION_DENIED' });
await assert.rejects(call(a, 'completeMeetup', { meetupId }), { code: 'FAILED_PRECONDITION' });
const confirmed = await call(a, 'confirmSchedule', { meetupId, slotId });
assert.equal(confirmed.slotId, slotId);
check('Vote editing, explicit date confirmation and host-only permissions');

const places = [
  { name: 'Tokyo Station', placeId: 'e2e-tokyo', latitude: 35.6812, longitude: 139.7671 },
  { name: 'Ueno Park', placeId: 'e2e-ueno', latitude: 35.715, longitude: 139.774 },
];
await call(a, 'confirmMeetingPlace', { meetupId, meetingPlace: places[0] });
for (const [i, place] of places.entries()) {
  const item = await call(i ? b : a, 'createPlanItem', { meetupId, item: {
    type: 'activity', title: place.name, place, scheduledAt: `2026-09-20T0${3 + i}:00:00Z`,
  } });
  await call(b, 'setPlanItemStatus', { meetupId, itemId: item.id, status: 'completed' });
}
await assert.rejects(call(b, 'completeMeetup', { meetupId }), { code: 'PERMISSION_DENIED' });
await call(a, 'completeMeetup', { meetupId });
await call(a, 'completeMeetup', { meetupId }); // Repeated requests must not duplicate the meeting count.
await assert.rejects(call(b, 'createPlanItem', { meetupId, item: { type: 'other', title: 'late' } }), { code: 'FAILED_PRECONDITION' });
check('Shared plan creation, item completion, host completion and finished-plan lock');

for (const [user, peer] of [[a, b], [b, a]]) {
  const overview = await call(user, 'getMySocialOverview');
  assert.equal(overview.friends[0].completedCount, 1);
  assert.equal(overview.friends[0].plannedCount, 0);
  assert.equal(overview.memories.length, 1);
  const history = await call(user, 'getFriendHistory', { otherUid: peer.uid });
  assert.equal(history.completedMeetupCount, 1);
  assert.deepEqual(history.meetups.map(m => m.id), [meetupId]);
  assert(!history.meetups.some(m => m.id === privateMeeting.meetupId));
  const journey = await call(user, 'getMyTravelTimeline');
  assert.equal(journey.summary.completedMeetupCount, 1);
  assert.equal(journey.summary.totalStops, 2);
  assert.deepEqual(journey.stops.map(s => s.place.name), places.map(p => p.name));
}
await assert.rejects(call(outsider, 'getFriendHistory', { otherUid: a.uid }), { code: 'NOT_FOUND' });
await assert.rejects(call(guest, 'getMySocialOverview'), { code: 'FAILED_PRECONDITION' });
check('Reciprocal completed counts, shared history privacy and ordered two-stop Journeys');

await call(a, 'saveMeetupMemory', { meetupId, body: 'E2E memory' });
assert.equal((await call(b, 'getMeetupMemories', { meetupId })).notes[0].body, 'E2E memory');
await assert.rejects(call(outsider, 'getMeetupMemories', { meetupId }), { code: 'PERMISSION_DENIED' });
await assert.rejects(call(guest, 'saveMeetupMemory', { meetupId, body: 'guest' }), { code: 'FAILED_PRECONDITION' });
await call(a, 'saveMeetupMemory', { meetupId, body: 'Edited memory' });
assert.equal((await call(b, 'getMeetupMemories', { meetupId })).notes.length, 1);
await call(a, 'deleteMeetupMemory', { meetupId });
assert.equal((await call(b, 'getMeetupMemories', { meetupId })).notes.length, 0);
check('Memory create/read/edit/delete and authorization');
const sorted = timings.map(t => t.ms).sort((a, b) => a - b);
console.log(JSON.stringify({ requests: timings.length, localP50Ms: sorted[Math.floor(sorted.length * .5)], localP95Ms: sorted[Math.floor(sorted.length * .95)], slowest: [...timings].sort((a,b) => b.ms-a.ms).slice(0,5) }));
console.log('Local demo fixtures retained until emulator shutdown. No production writes or Google OAuth UI tested.');
