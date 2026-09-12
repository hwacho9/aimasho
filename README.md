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

운영 주소는 **https://aimasho.web.app/** 입니다. Firebase Hosting → Cloud Run 구조의 전체 배포 방법은 [read.md](./read.md), Web/iOS 자동 테스트는 [E2E 보고서](./docs/e2e-social-flow.md)를 참고하세요. `npm run deploy`는 서버 함수·Firestore·웹 서버·Hosting을 순서대로 갱신합니다.

Google Maps Embed 키 분리와 Places/Routes 비용은 [Google 지도 표시와 Places 비용 운영 가이드](./docs/google-maps-embed-and-pricing.md)에 정리했습니다.

## Configure Firebase

1. The current production project is `aimasho` in `.firebaserc`. Enable **Anonymous Authentication**, **Google Authentication**, and **Cloud Firestore** for your own project if creating a separate environment.
2. Copy `web/.env.example` to `web/.env.local` and fill in the Firebase Web app configuration.
3. Copy `mobile/firebase.env.example.json` to a local file such as `mobile/firebase.env.json`, fill it in, and launch Flutter with `flutter run --dart-define-from-file=firebase.env.json` from `mobile/`.
4. Deploy backend and rules with `npm run deploy`. The Firebase CLI must be authenticated to the selected project.

### Maps mode

The repository runs with deterministic Japanese station data by default. Copy `functions/.env.example` to `functions/.env` to configure it. To use production Google Places and Routes calls, set `USE_MOCK_MAPS=false` and put a server-restricted `GOOGLE_MAPS_SERVER_API_KEY` in that file. The key is never read by Web or Flutter clients.

For local emulators, use a development Firebase project ID in the same settings and set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` for Web and `USE_FIREBASE_EMULATOR=true` in the Flutter env file. Start with `npm run emulators` from the repository root.

### Google Analytics

Enable Google Analytics in Firebase Console → Project settings → Integrations. Copy the Firebase Web app's Measurement ID (the `G-...` value) into `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` and `FIREBASE_MEASUREMENT_ID`. The web app records page use automatically and both clients log only anonymous product events such as meetup creation, joining, route calculation, and expense changes. Names, titles, locations, IDs, and amounts are never sent as event parameters.

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
