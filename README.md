# aimasho

`みんなの「いつ・どこ・何時に出る？」を、ひとつに。`

Phase 0–3 MVP: Firebase Anonymous Authentication, meetup creation, invite links, guest join, realtime ○ / △ / × voting, backend schedule ranking, and host schedule confirmation.

## Structure

- `web/` — Next.js guest-first web experience
- `mobile/` — Flutter iOS / Android experience
- `functions/` — Firebase Cloud Functions; source of truth for scheduling
- `firebase/` — deployable Firestore and Storage rules
- `docs/` — full specification and API contracts

외부 서비스 설정, Callable API, 지도·알림 연동 방법은 [한국어 API 연동 가이드](./docs/API-연동-가이드.md)를 참고하세요.

## Configure Firebase

1. Create a Firebase project in the `asia-northeast1` region, enable **Anonymous Authentication** and **Cloud Firestore**, then replace `REPLACE_WITH_FIREBASE_PROJECT_ID` in `.firebaserc`.
2. Copy `web/.env.example` to `web/.env.local` and fill in the Firebase Web app configuration.
3. Copy `mobile/firebase.env.example.json` to a local file such as `mobile/firebase.env.json`, fill it in, and launch Flutter with `flutter run --dart-define-from-file=firebase.env.json` from `mobile/`.
4. Deploy backend and rules with `npm run deploy`. The Firebase CLI must be authenticated to the selected project.

### Maps mode

The repository runs with deterministic Japanese station data by default. Copy `functions/.env.example` to `functions/.env` to configure it. To use production Google Places and Routes calls, set `USE_MOCK_MAPS=false` and put a server-restricted `GOOGLE_MAPS_SERVER_API_KEY` in that file. The key is never read by Web or Flutter clients.

For local emulators, use a development Firebase project ID in the same settings and set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` for Web and `USE_FIREBASE_EMULATOR=true` in the Flutter env file. Start with `npm run emulators` from the repository root.

### Departure reminders

When the Flutter app is allowed to send notifications, it registers an FCM token only for the participant's own route. `sendDepartureNotifications` is a Cloud Scheduler job that checks due routes every minute. Before a production deployment, enable Firebase Cloud Messaging and Cloud Scheduler; iOS also needs an APNs key/certificate configured in Firebase. The scheduled-job records and device tokens are server-only.

## Development and checks

```bash
# Web
cd web && npm run dev

# Functions
cd functions && npm run build && npm test

# Flutter
cd mobile && flutter analyze && flutter test
```

The committed security rules permit writes only through authenticated users. The callable Functions validate host-only actions independently; client UI checks are not an authorization boundary.

`firebase/storage.rules` is included for the later attachment/avatar phase but is not deployed by this milestone.
