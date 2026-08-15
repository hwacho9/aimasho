# aimasho API 연동 가이드

이 문서는 aimasho에서 사용하는 외부 API, Firebase 서비스, 앱 내부 Callable API를 한국어로 정리한 운영·개발 가이드입니다. 실제 요청은 Web과 Flutter가 Firebase Cloud Functions를 호출하고, 민감한 외부 API는 Functions 서버에서만 사용합니다.

## 1. 전체 구조

```text
Web (Next.js) / Mobile (Flutter)
        │ Firebase Authentication 토큰
        ▼
Firebase Callable Functions (asia-northeast1)
        ├─ Cloud Firestore: 약속·참가자·투표·정산·Room
        ├─ Google Places API: 장소 검색
        ├─ Google Routes API: 대중교통 경로·소요 시간
        └─ Firebase Cloud Messaging: 출발 알림
                 ▲
        Cloud Scheduler (1분마다 알림 작업 확인)
```

클라이언트는 Firestore를 구독해 실시간 화면을 갱신하지만, 약속 생성·일정 확정·장소 확정·정산·Room 변경과 같은 상태 변경은 Callable Functions를 통해서만 처리합니다.

## 2. 사용하는 외부 서비스

| 서비스 | 용도 | 필요한 설정 |
| --- | --- | --- |
| Firebase Authentication | 익명 시작, Google 계정 전환 | Anonymous 및 Google 로그인 제공업체 활성화 |
| Cloud Firestore | 약속, 투표, 경로, 비용, Room 데이터 | Firestore 생성 및 보안 규칙 배포 |
| Cloud Functions for Firebase v2 | 권한 검증 및 핵심 비즈니스 로직 | `asia-northeast1` 리전 배포 |
| Google Places API (New) | 장소·역 텍스트 검색 | `USE_MOCK_MAPS=false`, 서버 키 설정 |
| Google Routes API | 대중교통 경로와 소요 시간 계산 | 같은 서버 키에 Routes API 권한 부여 |
| Firebase Cloud Messaging (FCM) | 출발 시간 푸시 알림 | Android/iOS 앱 등록 및 FCM 설정 |
| Cloud Scheduler | 매분 출발 알림 작업 확인 | Functions 배포 전 활성화 |

## 3. 환경 변수와 키 관리

### Web — `web/.env.local`

`web/.env.example`을 복사해서 Firebase Web 앱 설정을 입력합니다.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

`NEXT_PUBLIC_*` 값은 브라우저에 노출되는 Firebase 앱 식별 정보입니다. Firebase 보안의 핵심은 API 키 은닉이 아니라 Authentication, Firestore Rules, Callable Functions 권한 검증입니다.

### Flutter — `mobile/firebase.env.json`

`mobile/firebase.env.example.json`을 복사한 뒤 실행 시 주입합니다.

```bash
cd mobile
flutter run --dart-define-from-file=firebase.env.json
```

### Functions — `functions/.env`

```dotenv
# 로컬 UI 확인과 테스트의 기본값
USE_MOCK_MAPS=true

# 실제 Google 지도 API를 쓸 때만 설정
GOOGLE_MAPS_SERVER_API_KEY=
```

`GOOGLE_MAPS_SERVER_API_KEY`는 Cloud Functions 서버에서만 읽습니다. `web/.env.local`, Flutter `--dart-define`, Git 저장소에 넣으면 안 됩니다. Google Cloud Console에서는 이 키를 Places API (New)와 Routes API만 허용하도록 제한하세요.

## 4. 개발·테스트 모드

### 화면만 확인하기

```bash
cd web
npm run dev
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다. Firebase 환경 변수가 없으면 연결 안내 화면이 표시되며, 랜딩 화면의 디자인은 바로 확인할 수 있습니다.

### Firebase Emulator로 전체 흐름 확인하기

1. `.firebaserc`의 프로젝트 ID를 개발용 Firebase 프로젝트 ID로 바꿉니다.
2. Web 환경 파일에서 `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`로 설정합니다.
3. Flutter 환경 파일에서 `USE_FIREBASE_EMULATOR=true`로 설정합니다.
4. 프로젝트 루트에서 Emulator를 실행합니다.

```bash
npm run emulators
```

Emulator 포트는 Authentication `9099`, Functions `5001`, Firestore `8080`, Emulator UI `4000`입니다. 지도는 기본적으로 모의 역·경로 데이터로 동작하므로 이 단계에서 Google Maps API 키가 필요하지 않습니다.

## 5. 앱 내부 Callable API

모든 Callable API는 `asia-northeast1` 리전에 있고 Firebase Authentication이 필요합니다. 익명 계정도 기본 약속 흐름에는 사용할 수 있지만, 계정 전환·기본 출발지·Room은 등록 계정이 필요합니다.

### 약속 및 일정

| 함수 | 호출 주체 | 설명 |
| --- | --- | --- |
| `createMeetup` | 로그인 사용자 | 약속과 후보 시간을 생성합니다. `roomId`를 전달하면 Room 멤버를 참가자로 추가합니다. |
| `getMeetupInvitePreview` | 로그인 사용자 | 초대 링크에서 가입 전에 보여줄 제목·호스트 정보를 가져옵니다. |
| `joinMeetup` | 로그인 사용자 | 표시 이름으로 약속에 참가합니다. |
| `upsertVote` | 참가자 | 후보 시간에 `YES` / `MAYBE` / `NO` 투표를 저장합니다. |
| `calculateScheduleRecommendation` | 참가자 | `NO` 최소 → `YES` 최대 → 점수 순으로 후보 시간을 추천합니다. |
| `confirmSchedule` | 호스트 | 후보 하나를 확정하고 위치 수집 단계로 전환합니다. |

`createMeetup`의 대표 요청입니다.

```json
{
  "displayName": "성화",
  "title": "친구들과 저녁",
  "description": "선택 사항",
  "durationMinutes": 120,
  "candidateSlots": ["2026-08-21T10:00:00.000Z"],
  "roomId": "선택 사항"
}
```

### 출발지·장소·경로

| 함수 | 호출 주체 | 설명 |
| --- | --- | --- |
| `searchPlaces` | 로그인 사용자 | 텍스트로 장소를 검색합니다. Google Places 또는 모의 데이터가 응답합니다. |
| `saveOrigin` | 참가자 | 자신의 출발지를 저장합니다. 정확한 좌표는 본인과 서버만 볼 수 있습니다. |
| `getOriginCollectionStatus` | 참가자 | 참가자별 출발지 등록 여부만 확인합니다. |
| `beginLocationSelection` | 호스트 | 출발지가 2개 이상일 때 장소 선택 단계로 전환합니다. |
| `getMeetingPointRecommendations` | 참가자 | `FAIR`(공평) 또는 `FAST`(빠름) 기준의 중간지점 후보를 계산합니다. |
| `confirmMeetingPlace` | 호스트 | 추천 후보 또는 검색 장소를 약속 장소로 확정합니다. |
| `calculateRoutes` | 참가자 | 각자 도착 목표 시간과 출발 시간을 계산합니다. |
| `registerDeviceToken` | 참가자 | 해당 약속의 본인 출발 알림용 FCM 토큰을 서버에 등록합니다. |

`saveOrigin` 요청 형식입니다.

```json
{
  "meetupId": "약속 ID",
  "origin": {
    "placeId": "Google Place ID 또는 mock ID",
    "name": "渋谷駅",
    "address": "東京都渋谷区道玄坂1丁目",
    "latitude": 35.658034,
    "longitude": 139.701636
  }
}
```

정확한 출발지 좌표는 `meetups/{meetupId}/privateOrigins/{uid}`에 저장합니다. 다른 참가자의 화면에는 등록 여부와 지역명만 표시됩니다. 경로 결과에는 지도 외부 링크가 포함되며, 그 링크로 Google Maps 앱/웹을 열 수 있습니다.

### 정산

| 함수 | 호출 주체 | 설명 |
| --- | --- | --- |
| `createExpense` | 참가자 | 엔화 정수 금액, 결제자, 분담 대상을 기록합니다. |
| `calculateSettlementResult` | 참가자 | 잔액과 최소 송금 횟수의 정산 결과를 계산합니다. |

금액은 소수점 없는 엔화 정수만 허용합니다. 이 기능은 정산 안내만 제공하며 실제 결제를 실행하지 않습니다.

### 프로필 및 Room

| 함수 | 호출 주체 | 설명 |
| --- | --- | --- |
| `saveProfile` | 로그인 사용자 | 표시 이름과 계정 상태를 저장합니다. |
| `saveDefaultOrigin` | 등록 계정 | 기본 출발지를 저장합니다. |
| `createRoom` | 등록 계정 | Room과 초대 코드를 만듭니다. |
| `getRoomInvitePreview` | 로그인 사용자 | `/r/{inviteCode}`에서 Room 이름·생성자 정보를 보여줍니다. |
| `joinRoom` | 등록 계정 | 초대 코드로 Room에 참가합니다. |
| `getMyRooms` | 등록 계정 | 현재 계정이 참여한 Room 목록을 가져옵니다. |
| `getRoomDetail` | Room 멤버 | 멤버와 Room 약속 목록을 가져옵니다. |

## 6. Google Maps API 동작

`USE_MOCK_MAPS=true`일 때는 도쿄권 역 9개와 거리 기반의 결정적 모의 경로를 사용합니다. 개발·데모·자동 테스트에 적합합니다.

`USE_MOCK_MAPS=false`일 때 Functions는 다음 REST API를 호출합니다.

| API | 엔드포인트 | 사용 목적 |
| --- | --- | --- |
| Places API (New) | `POST https://places.googleapis.com/v1/places:searchText` | 장소 검색과 중간지점 후보 검색 |
| Routes API | `POST https://routes.googleapis.com/directions/v2:computeRoutes` | 대중교통 경로 및 예상 소요 시간 |

Routes API는 `TRANSIT` 모드와 약속 10분 전 도착 목표 시간을 사용해 각 참가자의 출발 시간을 계산합니다. Places/Routes 응답 실패는 Callable API 오류로 클라이언트에 전달됩니다.

Google Maps의 범용 Directions URL은 출발지·도착지·이동 수단은 전달할 수 있지만, 특정 대중교통 출발 시각을 전달하는 공식 파라미터는 제공하지 않습니다. 따라서 앱이 계산한 출발 시각이 기준 정보이며, 외부 Google Maps 화면은 현재 시각 기준의 경로를 표시할 수 있습니다.

## 7. 출발 알림(FCM) 동작

1. Flutter 앱이 알림 권한을 요청합니다.
2. 허용 시 `registerDeviceToken`이 본인 FCM 토큰을 Functions에 저장합니다.
3. `calculateRoutes`가 경로를 계산하면 토큰이 있는 참가자의 알림 작업을 생성·갱신합니다.
4. `sendDepartureNotifications`가 Cloud Scheduler로 매분 실행됩니다.
5. 출발 시각이 지난 작업에 FCM을 1회 발송하고 상태를 `SENT`로 바꿉니다.

알림 작업과 FCM 토큰은 Firestore 클라이언트 보안 규칙으로 공개하지 않습니다. Android 13 이상은 앱 알림 권한이 필요하고, iOS는 Firebase Console에 APNs 키 또는 인증서를 추가해야 합니다.

## 8. 보안과 운영 점검

- 지도 서버 키, 서비스 계정, APNs 키, FCM 관련 비밀값은 저장소에 커밋하지 않습니다.
- Callable API는 각 요청에서 인증, 참가자 여부, 호스트 권한을 다시 검증합니다. 화면의 버튼 숨김만으로 권한을 보장하지 않습니다.
- Firestore Rules와 인덱스는 Functions 배포와 함께 배포합니다.
- 실제 Google Maps 모드 전환 전에는 API 사용량 예산·알림을 설정하고 키를 API와 서버 환경으로 제한합니다.
- Cloud Scheduler와 FCM은 실 Firebase 프로젝트에서 배포 후 알림 권한 허용 기기로 최종 확인합니다.

상세 입력·응답 계약은 [api-contracts.md](./api-contracts.md), 전체 제품 명세는 [specification.md](./specification.md)를 참고하세요.
