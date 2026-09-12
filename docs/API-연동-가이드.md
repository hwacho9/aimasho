# aimasho API 연동 가이드

이 문서는 aimasho에서 사용하는 외부 API, Firebase 서비스, 앱 내부 Callable API를 한국어로 정리한 운영·개발 가이드입니다. 실제 요청은 Web과 Flutter가 Firebase Cloud Functions를 호출하고, 민감한 외부 API는 Functions 서버에서만 사용합니다.

## 1. 전체 구조

```text
Web (Next.js) / Mobile (Flutter)
        │ Firebase Authentication 토큰
        ▼
Firebase Callable Functions (asia-northeast1)
        ├─ Cloud Firestore: 약속·참가자·관계·투표·정산·Room
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
| Google Maps Embed API | 웹의 선택한 장소·당일 플랜 지도 | 별도 브라우저용 Embed 키, 웹사이트 제한 |
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
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

`NEXT_PUBLIC_*` 값은 브라우저에 노출되는 Firebase 앱 식별 정보입니다. Firebase 보안의 핵심은 API 키 은닉이 아니라 Authentication, Firestore Rules, Callable Functions 권한 검증입니다.

`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`에는 Firebase 웹 앱 설정의 `measurementId`(`G-`로 시작)를 넣습니다. 값이 없으면 웹 Analytics는 자동으로 비활성화되므로 로컬 개발과 에뮬레이터 테스트 데이터는 운영 분석 속성으로 전송되지 않습니다.

### 웹 장소 지도 설정 (Maps Embed API)

장소 검색용 서버 키와 지도 표시용 브라우저 키는 분리합니다. 기존 `GOOGLE_MAPS_SERVER_API_KEY` 또는 Firebase 키를 아래 값에 넣지 마세요.

1. Google Cloud에서 **Maps Embed API**를 활성화하고 별도 브라우저용 API 키를 만듭니다.
2. 키의 API 제한은 **Maps Embed API만**, 애플리케이션 제한은 **웹사이트**로 지정합니다. 실제 사용하는 주소만 허용합니다. 예: `https://aimasho.web.app/*`, 로컬 개발용 `http://localhost:3000/*`, `http://127.0.0.1:4317/*`. `aimasho.app` 등 다른 운영 도메인은 실제 사용 시 추가합니다.
3. `web/.env.local`에 `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=브라우저용_키`를 설정합니다. 로컬 Next/Vite 서버를 다시 시작합니다. 키를 채팅이나 Git에 붙이지 마세요.
4. 운영에서는 **Next 빌드 환경**에도 같은 변수를 설정한 뒤 웹을 다시 빌드·배포해야 합니다. Cloud Run 런타임 변수만 바꾸거나 Hosting만 배포하면 기존 JS 번들은 바뀌지 않습니다.

선택한 장소와 확정된 집합 장소는 lazy iframe으로 표시합니다. 저장된 당일 플랜의 지도는 `地図を見る / 지도 보기`를 눌러야 iframe을 만들고, 접으면 제거합니다. Maps JavaScript SDK나 별도 서버 호출은 추가하지 않았습니다. 장소 ID를 우선 사용하고, 없는 기존 데이터는 좌표로 표시합니다. 지도에는 사이트 origin만 referrer로 전달하여 모임 경로나 초대 링크를 전달하지 않습니다.

키가 없으면 Google Embed 요청을 보내지 않고, 좌표가 있는 장소는 카드 안에 OpenStreetMap 미리보기를 보여줍니다. 좌표가 없는 기존 장소에는 이름·주소와 **Google Maps에서 열기** 링크를 표시합니다. 키 제한/API 설정 오류는 Google iframe 내부에 표시될 수 있으므로 외부 지도 링크는 항상 유지합니다. 출발·도착 시간 계산은 다시 활성화하지 않습니다.

키 분리, 실제 Field Mask, 월별 무료 한도·예상 비용·예산 알림은 [Google 지도 표시와 Places 비용 운영 가이드](./google-maps-embed-and-pricing.md)를 참고합니다.

공식 안내: [Maps Embed 설정](https://developers.google.com/maps/documentation/embed/get-api-key), [iframe 및 장소 ID](https://developers.google.com/maps/documentation/embed/embedding-map), [Next 공개 환경 변수의 빌드 시 적용](https://nextjs.org/docs/app/guides/environment-variables).

### Google 로그인 설정

웹의 `/login`은 Google 계정 하나로 로그인과 신규 가입을 함께 처리합니다. 별도의 Google OAuth 클라이언트 ID나 클라이언트 보안 키를 Web 환경 변수에 넣을 필요는 없습니다. Firebase Authentication이 Google 제공업체 설정과 OAuth 처리를 담당합니다.

1. Firebase Console에서 프로젝트를 열고 **Authentication** → **Sign-in method**로 이동합니다.
2. **Google**을 선택해 사용 설정하고, 프로젝트 지원 이메일과 앱에 표시할 이름을 확인한 뒤 **저장**합니다.
3. **Anonymous**도 사용 설정 상태로 유지합니다. 로그인 전 게스트로 만든 약속을 Google 계정으로 연결할 때 같은 Firebase 사용자 ID를 유지하기 때문입니다.
4. **Authentication** → **Settings** → **Authorized domains**에서 실제 배포 도메인(예: `aimasho.example`)을 추가합니다. 로컬에서 `localhost`가 허용 목록에 없다면 `localhost`도 추가합니다. `127.0.0.1`로 개발 서버를 열 때 로그인 오류가 나면 `localhost:3000` 대신 `http://localhost:3000`으로 접속해 확인하는 편이 안전합니다.
5. `web/.env.local`의 `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`은 Firebase Web 앱 설정에 나온 값(일반적으로 `<프로젝트 ID>.firebaseapp.com`)을 유지하고, 개발 서버를 다시 시작합니다.

홈 화면의 **로그인** 또는 **이미 계정이 있나요? 로그인**을 누르면 `/login`으로 이동합니다. 이미 게스트로 약속을 만들었다면 같은 브라우저에서 Google로 로그인할 경우 그 게스트 계정에 Google 자격 증명을 연결해 기존 약속을 유지합니다.

#### `installations/request-failed` (400 `INVALID_ARGUMENT`) 해결

이 오류는 지도 경로 API 오류가 아니라 Firebase Web SDK가 브라우저 설치 ID를 만들 때 Firebase 앱 설정을 거절한 경우입니다. 다음 순서로 확인합니다.

1. Firebase Console → **프로젝트 설정** → **내 앱** → 등록한 **웹 앱** → **SDK 설정 및 구성**에서 표시되는 `firebaseConfig`를 다시 복사합니다. 그 값과 동일하게 `NEXT_PUBLIC_FIREBASE_API_KEY`, `PROJECT_ID`, `APP_ID`, `MESSAGING_SENDER_ID`를 입력합니다. 이 네 값은 다른 Firebase 프로젝트나 모바일 앱의 값과 섞으면 안 됩니다.
2. `NEXT_PUBLIC_FIREBASE_API_KEY`에는 Google Maps 키가 아니라 위 `firebaseConfig`의 `apiKey`를 넣습니다. Maps/Routes/Places용 키는 `functions/.env`의 `GOOGLE_MAPS_SERVER_API_KEY`에만 둡니다.
3. Google Cloud Console → **APIs 및 서비스** → **사용자 인증 정보**에서 Firebase 웹 앱 키의 제한을 확인합니다. Maps API만 허용한 키를 Firebase 키로 사용하면 안 됩니다. Firebase가 자동 생성한 웹 키를 쓰거나, 해당 키의 Firebase 관련 API 제한을 유지합니다.
4. 개발 서버를 완전히 종료한 뒤 `cd web && npm run dev`로 다시 시작하고 `http://localhost:3000`에서 다시 확인합니다.
5. 설정을 바로잡은 뒤에도 로컬에서만 반복되면 Chrome 개발자 도구 → **Application** → **IndexedDB**의 `firebase-installations-database`만 삭제하고 새로고침합니다. **Clear site data**는 익명 로그인 상태까지 지울 수 있으므로, 게스트로 만든 테스트 약속이 있다면 사용하지 마세요.

### Flutter — `mobile/firebase.env.json`

`mobile/firebase.env.example.json`을 복사한 뒤 실행 시 주입합니다.

```bash
cd mobile
flutter run --dart-define-from-file=firebase.env.json
```

`firebase.env.json`에는 필요하면 `FIREBASE_MEASUREMENT_ID`도 추가합니다. iOS/Android/macOS 앱은 Firebase Console에 각 플랫폼 앱을 등록한 뒤 Firebase 설정의 앱 ID를 기존 `FIREBASE_APP_ID`에 넣어야 합니다.

### Google Analytics 설정 및 이벤트

1. Firebase Console → **프로젝트 설정** → **통합**에서 Google Analytics를 사용 설정합니다.
2. 웹 Firebase 앱 설정의 `measurementId`를 Web/Flutter 환경 파일에 설정합니다.
3. Flutter 앱을 새로 등록하거나 플랫폼을 추가했다면 `flutterfire configure`를 실행해 Firebase 앱 등록 정보를 최신화합니다.

앱은 화면 사용량과 아래처럼 익명화된 제품 행동만 수집합니다. 약속 제목, 참가자 이름, 장소, 초대 코드, 문서 ID, 지출 금액은 이벤트 매개변수로 보내지 않습니다.

| 이벤트 | 발생 시점 |
| --- | --- |
| `meetup_created`, `meetup_joined` | 약속 생성 또는 참여 성공 |
| `schedule_confirmed`, `meeting_place_confirmed` | 일정 또는 만남 장소 확정 성공 |
| `routes_calculated` | 출발 시간 계산 성공 |
| `expense_created`, `expense_updated`, `expense_deleted` | 지출 추가·수정·삭제 성공 |
| `room_created`, `room_joined` | Room 생성 또는 참여 성공 |

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
| `upsertVote` | 참가자 | 후보 시간에 `YES` / `MAYBE` / `NO` 투표를 저장합니다. 응답 마감 이후에는 새 응답을 거절합니다. |
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
  "responseDeadline": "2026-08-19T14:59:00.000Z",
  "roomId": "선택 사항"
}
```

`responseDeadline`은 선택 사항이며 미래의 ISO 날짜·시간이어야 합니다. 설정하면 Web과 Flutter 모두 남은 마감을 표시하고, 마감 후에는 날짜 투표와 후보 추가를 비활성화합니다. 서버도 같은 조건을 검증하므로 오래 열린 화면이나 직접 API 호출로 마감을 우회할 수 없습니다.

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
| `updateExpense` | 지출 등록자 | 기존 지출의 항목·금액·결제자·분담 대상을 수정합니다. |
| `deleteExpense` | 지출 등록자 | 본인이 등록한 지출 항목을 삭제합니다. |
| `calculateSettlementResult` | 참가자 | 잔액과 최소 송금 횟수의 정산 결과를 계산합니다. |

금액은 소수점 없는 엔화 정수만 허용합니다. 지출 수정과 삭제는 화면 버튼뿐 아니라 서버에서도 지출 등록자만 허용합니다. 이 기능은 정산 안내만 제공하며 실제 결제를 실행하지 않습니다.

### 프로필 및 Room

| 함수 | 호출 주체 | 설명 |
| --- | --- | --- |
| `saveProfile` | 로그인 사용자 | 표시 이름과 계정 상태를 저장합니다. |
| `getMeetupRelationships` | 약속 참가자인 등록 계정 | 현재 약속에서 함께한 등록 사용자별 약속 횟수와 관계 단계를 표시할 수 있는 집계를 가져옵니다. |
| `getMyRelationships` | 등록 계정 | 내 프로필에 표시할 전체 관계 목록을 최근 약속 순으로 가져옵니다. |
| `getFriendHistory` | 등록 계정 | 특정 친구와 함께한 횟수, 약속 목록, 둘만의 Journey 장소를 가져옵니다. |
| `getMyTravelTimeline` | 등록 계정 | 완료된 약속 장소를 날짜순으로 가져와 Journey 재생 화면에 사용합니다. |
| `saveDefaultOrigin` | 등록 계정 | 기본 출발지를 저장합니다. |
| `createRoom` | 등록 계정 | Room과 초대 코드를 만듭니다. |
| `getRoomInvitePreview` | 로그인 사용자 | `/r/{inviteCode}`에서 Room 이름·생성자 정보를 보여줍니다. |
| `joinRoom` | 등록 계정 | 초대 코드로 Room에 참가합니다. |
| `getMyRooms` | 등록 계정 | 현재 계정이 참여한 Room 목록을 가져옵니다. |
| `getRoomDetail` | Room 멤버 | 멤버와 Room 약속 목록을 가져옵니다. |

#### 친구 관계·약속 횟수 집계

관계 데이터는 **프로필을 저장한 등록 계정끼리만** 생성합니다. 같은 약속의 참가자로 기록된 두 사람이 있으면 그 약속을 한 번으로 세며, 익명 참가자는 집계와 관계 화면에 포함하지 않습니다. 동일 약속을 새로고침하거나 재참여해도 서버가 약속별 사용자 쌍 마커를 확인하므로 중복 증가하지 않습니다.

프로필을 나중에 Google 계정으로 전환하면 `saveProfile`과 관계 조회 시점에 과거 참여 약속도 한 번씩 보정합니다. 화면용 관계 단계는 다음 기준입니다.

| 함께한 약속 수 | 관계 단계 |
| --- | --- |
| 1회 | 새로운 친구 |
| 2–3회 | 함께 만나는 사이 |
| 4–7회 | 자주 만나는 친구 |
| 8회 이상 | 찐친 |

두 조회 API의 응답 항목은 아래와 같습니다.

```json
{
  "relationships": [
    {
      "otherUid": "친구 Firebase UID",
      "displayName": "유키",
      "sharedMeetupCount": 4,
      "lastMeetupId": "가장 최근에 함께한 약속 ID"
    }
  ]
}
```

관계 문서는 `users/{uid}/relationships/{otherUid}`에 서버만 기록합니다. 클라이언트는 다른 사람의 전체 관계 목록을 Firestore에서 직접 읽을 수 없고, 자신의 데이터만 위 Callable API를 통해 받습니다.

#### Journey 지도 재생 데이터

`getMyTravelTimeline`은 홈 대시보드와 별도로 호출합니다. 완료된 약속의 `planItems` 중 완료 처리된 장소를 우선 사용하고, 없으면 확정 모임 장소를 사용합니다. 화면은 반환된 장소를 날짜순으로 연결해 경로선과 현재 마커를 애니메이션으로 재생합니다.

이 데이터는 **실제 GPS 위치 기록이 아닙니다.** 사용자가 aimasho 약속에 직접 저장한 장소만 포함하며, 백그라운드 위치 추적·상시 위치 수집·이동 구간 저장을 하지 않습니다. 같은 이유로 경로선은 실제 이동 도로나 교통수단 경로가 아니라 저장된 약속 장소 사이를 시각적으로 연결한 선입니다.

응답의 `summary`에는 완료 약속 수, 고유 방문 장소 수, 전체 여정 포인트 수가 들어갑니다. `getFriendHistory`도 같은 `stops` 구조를 반환하므로 친구 상세 화면에서 둘만의 Journey를 재생할 수 있습니다.

## 6. Google Maps API 동작

`USE_MOCK_MAPS=true`일 때는 도쿄권 역 9개와 거리 기반의 결정적 모의 경로를 사용합니다. 개발·데모·자동 테스트에 적합합니다.

`USE_MOCK_MAPS=false`일 때 Functions는 다음 REST API를 호출합니다.

| API | 엔드포인트 | 사용 목적 |
| --- | --- | --- |
| Places API (New) | `POST https://places.googleapis.com/v1/places:searchText` | 장소 검색과 중간지점 후보 검색 |
| Routes API | `POST https://routes.googleapis.com/directions/v2:computeRoutes` | 대중교통 경로 및 예상 소요 시간 |

Routes API는 `TRANSIT` 모드와 약속 10분 전 도착 목표 시간을 사용해 각 참가자의 출발 시간을 계산합니다. Places/Routes 응답 실패는 Callable API 오류로 클라이언트에 전달됩니다.

Google Maps의 범용 Directions URL은 출발지·도착지·이동 수단은 전달할 수 있지만, 특정 대중교통 출발 시각을 전달하는 공식 파라미터는 제공하지 않습니다. 따라서 앱이 계산한 출발 시각이 기준 정보이며, 외부 Google Maps 화면은 현재 시각 기준의 경로를 표시할 수 있습니다.

## 7. 일정 알림 및 출발 알림(FCM) 동작

확정된 일정 알림은 현재 사용할 수 있으며 출발 시간 계산과 독립적으로 동작합니다.

1. 참가자가 약속 화면에서 `일정 알림`을 켭니다.
2. Flutter 앱이 알림 권한과 FCM 토큰을 확인한 뒤 `setMeetupReminderPreference`를 호출합니다.
3. 서버는 확정 일정 24시간 전, 1시간 전, 10분 전의 `meetupReminders` 작업을 예약합니다.
4. `sendMeetupReminders`가 Cloud Scheduler로 매분 실행되어 한국어 또는 일본어 알림을 발송합니다.
5. 집합 시간이 바뀌면 아직 발송하지 않은 작업을 새 시간으로 교체합니다. 약속 완료·취소·삭제 시 예약 작업을 제거합니다.

```json
{
  "meetupId": "약속 ID",
  "enabled": true,
  "locale": "ko",
  "token": "FCM 기기 토큰",
  "platform": "ios"
}
```

출발 시간 알림은 대중교통 경로 기능과 함께 현재 비활성화되어 있습니다. 아래는 다시 활성화할 때의 처리 흐름입니다.

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
