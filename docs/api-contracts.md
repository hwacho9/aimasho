# aimasho API contracts — MVP Phase 0–9

All callable functions run in `asia-northeast1` and require Firebase Authentication. Anonymous accounts are valid users.

## `createMeetup`

```json
{
  "displayName": "성화",
  "title": "大学の友だちと夜ごはん",
  "description": "任意",
  "durationMinutes": 120,
  "candidateSlots": ["2026-08-21T10:00:00.000Z"]
}
```

Returns `{ "meetupId": "..." }`. It creates the host participant and up to 12 candidate slots atomically.

## `getMeetupInvitePreview`

Input `{ "meetupId": "..." }`; returns only the safe pre-join title, host name, status, and `isAlreadyParticipant` flag.

## `joinMeetup`

Input `{ "meetupId": "...", "displayName": "유키" }`; creates or updates the caller's non-host participant record.

## `upsertVote`

Input `{ "meetupId": "...", "slotId": "...", "status": "YES" | "MAYBE" | "NO" }`.

## `calculateScheduleRecommendation`

Input `{ "meetupId": "..." }`; returns the schedule ranking. Ordering is `NO` ascending → `YES` descending → weighted score descending → datetime ascending. `YES = 2`, `MAYBE = 1`, `NO = 0`.

## `confirmSchedule`

Input `{ "meetupId": "...", "slotId": "..." }`; host-only. It records `SCHEDULE_CONFIRMED` and `confirmedDateTime`.

## Phase 4–6: origin, place, routes

`searchPlaces` accepts `{ "query": "渋谷" }` and returns server-provided places. `saveOrigin` accepts `{ "meetupId", "origin" }`; exact coordinates are written only to `privateOrigins/{uid}`. Other participants can see only `hasOrigin`.

`beginLocationSelection` is host-only and requires at least two origins. `getMeetingPointRecommendations` accepts `{ "meetupId", "mode": "FAIR" | "FAST" }`; FAIR ranks `average + standardDeviation × 1.5 + maximum × 0.25`, while FAST ranks only average duration. `confirmMeetingPlace` is host-only.

`calculateRoutes` calculates each participant route and stores target arrival, departure time, duration, and a Google Maps URL. It never returns another user's origin.

`registerDeviceToken` accepts `{ "meetupId", "token" }` from the Flutter app after notification permission is granted. It stores the caller's token server-side and queues only that caller's route. `sendDepartureNotifications` is a server-only scheduled function; it sends a single FCM notification when the stored departure time is due.

## Phase 7: settlement

`createExpense` accepts `{ "meetupId", "title", "amount", "paidByUid", "participantUids" }`; amount is integer JPY. `calculateSettlementResult` returns balances and the minimum transfer list. It does not initiate payments.

## Phase 8: profiles and Rooms

`saveProfile` and `saveDefaultOrigin` support registered accounts. `createRoom`, `joinRoom`, `getMyRooms`, `getRoomDetail`, and `getRoomInvitePreview` manage persistent Room membership. Room creation and joining reject anonymous accounts. Room invite URLs use `/r/{inviteCode}`.
