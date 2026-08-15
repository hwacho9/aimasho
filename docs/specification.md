# aimasho MVP Product & Implementation Specification

## Web + Flutter App + Firebase

---

# 0. 프로젝트 개요

## 프로젝트명

**aimasho**

일본어 「会いましょう」에서 가져온 이름.

## 서비스 한 줄 설명

**친구들과 약속을 잡는 순간부터 실제로 만나고 정산할 때까지 하나의 흐름으로 연결하는 서비스.**

```text
일정 맞추기
→ 장소 정하기
→ 각자의 경로와 출발시간 계산
→ 만나기
→ 정산
```

---

# 1. 핵심 Product Concept

기존에는 친구들과 약속을 잡을 때 여러 서비스를 오가게 된다.

```text
LINE / 調整さん
→ 일정 조정

LINE
→ 장소 논의

Google Maps
→ 각자 이동시간 확인

LINE
→ 출발시간 공유

계산기 / 송금 앱
→ 정산
```

aimasho는 이를 하나의 `Meetup` 안에 연결한다.

```text
언제 만날까?
↓
어디서 만날까?
↓
나는 몇 시에 나가야 하지?
↓
누가 누구에게 얼마 보내야 하지?
```

---

# 2. Platform Strategy

aimasho는 MVP부터 다음 3개 플랫폼을 함께 구축한다.

```text
Web
→ Next.js

Mobile App
→ Flutter
   ├─ iOS
   └─ Android

Backend
→ Firebase
```

각 기능은 가능한 한 **Web과 Mobile 모두 구현된 상태를 완료 조건**으로 본다.

단, 플랫폼 특성상 Guest Share Flow는 Web을 우선하고, 반복 사용과 알림 UX는 App을 우선한다.

---

# 3. Platform Role

## Web

Web의 가장 중요한 역할:

```text
LINE에서 링크 클릭
↓
앱 설치 필요 없음
↓
이름 입력
↓
바로 일정 투표
```

따라서 Web은:

* Guest Join
* Invite Link
* 일정 투표
* 장소 확인
* 경로 확인
* 정산 참여

경험을 매우 빠르게 제공해야 한다.

---

## Mobile App

Mobile App의 주요 역할:

* 반복적인 aimasho 사용
* 내가 참여한 약속 관리
* Room 관리
* Push Notification
* 출발 알림
* 기본 출발 위치
* 과거 약속
* 정산 기록

그러나 App 역시 로그인 강제 없이 Guest Participation을 지원한다.

---

# 4. Product Principles

## 4.1 Guest First

초대 링크를 받은 사용자는 회원가입 없이 바로 참여 가능해야 한다.

```text
초대 링크
↓
이름 입력
↓
참여
```

Firebase Anonymous Authentication을 사용한다.

---

## 4.2 Account Optional

장기적으로 서비스를 사용하는 사람만 계정을 만든다.

회원 기능:

* 내 약속 목록
* Room
* 반복 약속
* 기본 출발 위치
* 과거 기록
* 여러 기기 사용
* Push Notification

---

## 4.3 Calendar Integration 없음

MVP에서는 Calendar 연동을 구현하지 않는다.

구현 금지:

```text
Google Calendar
Apple Calendar
자동 일정 Import
Calendar Free/Busy
```

일정 조정은 100% Manual Vote 방식이다.

---

## 4.4 Manual Scheduling

LINE 일정 / 調整さん 방식.

참가자는 후보별로:

```text
○ YES
△ MAYBE
× NO
```

를 입력한다.

---

## 4.5 Decision Assistance

aimasho는 정보만 나열하지 않는다.

추천해야 한다.

예:

```text
8/22 19:00

○ 4
△ 0
× 0

→ 전원 참석 가능
→ aimasho 추천
```

또는:

```text
渋谷駅

평균 이동시간 31분
최대 이동시간 44분
이동시간 편차 최소

→ aimasho 추천
```

---

# 5. 전체 User Flow

```text
Landing
 ↓
약속 생성
 ↓
후보 일정 등록
 ↓
Invite Link
 ↓
친구 참여
 ↓
○ △ × 일정 투표
 ↓
추천 일정
 ↓
Host 일정 확정
 ↓
각 참가자 출발 위치 입력
 ↓
장소 선택 방식
 ├─ 중간지점 추천
 └─ 직접 장소 지정
 ↓
Meeting Place 확정
 ↓
각자 Route 계산
 ↓
공통 Target Arrival Time
 ↓
각자 Departure Time 계산
 ↓
Meetup Day
 ↓
Expense 등록
 ↓
Settlement
```

---

# 6. 두 가지 Meetup Mode

## Mode A — Standalone Meetup

일회성 약속.

회원가입 불필요.

```text
약속 생성
→ Invite Link
→ 친구 참여
→ 약속 종료
```

데이터:

```ts
roomId: null
```

---

## Mode B — Room Meetup

장기적인 친구 그룹.

예:

```text
대학교 친구들
회사 동기
고등학교 친구들
Podcast 팀
```

Room 멤버가 유지된다.

```text
대학교 친구들
↓
새로운 약속 만들기
↓
기존 멤버 자동 선택
```

---

# 7. Architecture

```text
                         Firebase
               ┌────────────┼────────────┐
               │            │            │
         Authentication  Firestore   Cloud Functions
               │            │            │
        ┌──────┴──────┐     │      Business Logic
        │             │     │
    Next.js Web    Flutter App
                       │
                  iOS / Android
```

---

# 8. Tech Stack

## Web

```text
Next.js
TypeScript
App Router
Tailwind CSS
shadcn/ui
Firebase Web SDK
```

---

## Mobile

```text
Flutter
Dart
Material 3 기반 Custom UI
Firebase Flutter SDK
```

Navigation:

```text
go_router
```

권장.

State Management:

```text
Riverpod
```

권장.

MVP에서 Bloc / Redux 스타일의 과도한 구조는 사용하지 않는다.

---

## Backend

```text
Firebase Authentication

Cloud Firestore

Firebase Cloud Functions

Firebase Cloud Messaging

Firebase Storage
필요 시에만 사용
```

---

## Map / Route

```text
Google Maps Platform

Places API

Routes API

Route Matrix
```

---

# 9. Repository Structure

```text
aimasho/

├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── services/
│   │   └── types/
│   │
│   ├── public/
│   └── package.json
│
├── mobile/
│   ├── lib/
│   │   ├── app/
│   │   ├── features/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── providers/
│   │   └── widgets/
│   │
│   ├── ios/
│   ├── android/
│   └── pubspec.yaml
│
├── functions/
│   ├── src/
│   │   ├── auth/
│   │   ├── scheduling/
│   │   ├── meeting-point/
│   │   ├── routing/
│   │   ├── settlement/
│   │   └── shared/
│   │
│   └── package.json
│
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── storage.rules
│
├── docs/
│   └── specification.md
│
└── README.md
```

---

# 10. Source of Truth

Web과 Flutter는 언어가 다르다.

```text
Web
TypeScript

Mobile
Dart
```

따라서 핵심 결과를 결정하는 비즈니스 로직은 Client마다 따로 구현하지 않는다.

다음 Logic은 Firebase Cloud Functions 또는 서버 측 공통 Logic을 Source of Truth로 한다.

```text
Schedule Ranking

Meeting Point Ranking

Route Calculation

Target Arrival Calculation

Settlement Calculation

Settlement Transfer Optimization
```

---

# 11. Client-side Logic

UI 표시를 위한 간단한 계산은 Client에서도 가능하다.

하지만 최종 저장되는 결과는 Backend 결과를 사용한다.

예:

```text
Client
→ 예상 추천 결과 미리 표시 가능

Backend
→ 최종 추천 결과 계산
→ Firestore 저장
```

---

# 12. Authentication

## Guest

Firebase Anonymous Auth.

Flow:

```text
Meetup Link 접속
↓
Auth 없음
↓
signInAnonymously()
↓
Firebase UID
↓
이름 입력
↓
Participant 생성
```

사용자는 Anonymous Auth가 동작한다는 사실을 인지할 필요가 없다.

---

# 13. Registered User

MVP 지원:

```text
Google Sign-In
Apple Sign-In
```

우선순위:

```text
1. Google
2. Apple
```

---

# 14. Guest → Registered

Guest가 나중에 로그인하면 Anonymous Firebase Account에 Credential을 Link한다.

```text
Anonymous UID
↓
Google / Apple Credential Link
↓
Registered User
```

기존:

```text
Meetup
Votes
Routes
Expenses
Room
```

관계는 유지되어야 한다.

---

# 15. 회원가입 Conversion

처음부터 회원가입을 요구하지 않는다.

예:

```text
다음 약속도 aimasho에서?

계정을 만들면
이번 약속 기록을 저장하고
같은 친구들과 더 쉽게 약속을 만들 수 있어요.

[ Google로 계속하기 ]
[ Apple로 계속하기 ]

나중에
```

---

# 16. Core Firestore Structure

```text
users/
  {uid}

rooms/
  {roomId}
    members/
      {uid}

meetups/
  {meetupId}
    participants/
      {uid}

    candidateSlots/
      {slotId}

    votes/
      {voteId}

    routes/
      {uid}

    expenses/
      {expenseId}
```

---

# 17. User

```ts
interface UserProfile {
  uid: string;

  displayName: string;

  photoURL?: string;

  accountType: "ANONYMOUS" | "REGISTERED";

  defaultOrigin?: Location;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Anonymous User는 `users` document를 반드시 만들 필요는 없다.

---

# 18. Meetup

```ts
interface Meetup {
  id: string;

  roomId: string | null;

  title: string;
  description?: string;

  createdByUid: string;

  status: MeetupStatus;

  durationMinutes: number;

  confirmedDateTime?: Timestamp;

  meetingPlace?: MeetingPlace;

  arrivalBufferMinutes: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 19. Meetup Status

```ts
type MeetupStatus =
  | "SCHEDULING"
  | "SCHEDULE_CONFIRMED"
  | "LOCATION_COLLECTING"
  | "LOCATION_SELECTING"
  | "LOCATION_CONFIRMED"
  | "READY"
  | "COMPLETED";
```

---

# 20. Participant

```ts
interface Participant {
  uid: string;

  displayName: string;

  isGuest: boolean;

  isHost: boolean;

  origin?: Location;

  joinedAt: Timestamp;
}
```

Firestore:

```text
meetups/{meetupId}/participants/{uid}
```

---

# 21. Room

```ts
interface Room {
  id: string;

  name: string;

  ownerUid: string;

  inviteCode: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

# 22. Room Member

```ts
interface RoomMember {
  uid: string;

  displayName: string;

  photoURL?: string;

  role: "OWNER" | "MEMBER";

  joinedAt: Timestamp;
}
```

---

# 23. Location

```ts
interface Location {
  placeId: string;

  name: string;

  address?: string;

  latitude: number;
  longitude: number;
}
```

---

# 24. Deep Link Architecture

공통 URL:

```text
https://aimasho.app/m/{meetupId}

https://aimasho.app/r/{roomInviteCode}
```

---

# 25. Web Link Behavior

앱 미설치 또는 Browser에서 열 경우:

```text
LINE
↓
aimasho.app/m/ABC123
↓
Next.js
↓
Guest Join
```

---

# 26. App Link Behavior

App 설치 시:

```text
LINE
↓
aimasho.app/m/ABC123
↓
Universal Link / App Link
↓
Flutter App
↓
Meetup ABC123
```

iOS:

```text
Universal Links
```

Android:

```text
App Links
```

Web fallback 반드시 유지.

---

# 27. Screen 01 — Landing

## Web

```text
aimasho

みんなの
「いつ・どこ・何時に出る？」
を、ひとつに。

[ 약속 만들기 ]

[ 로그인 ]
```

---

## App

로그인 상태가 없더라도 Home 표시 가능.

```text
aimasho

[ 약속 만들기 ]

초대 링크가 있다면
바로 Meetup Join
```

---

# 28. Registered Home

Web / App 공통 정보:

```text
다가오는 약속

🍻 대학 친구 저녁
8/22 19:00
渋谷

내 모임

대학교 친구들
회사 동기

[ + 새로운 약속 ]
[ + 새로운 모임 ]
```

UI는 플랫폼별로 따로 구현한다.

---

# 29. Meetup 생성

입력:

```text
약속 이름

설명

후보 날짜/시간

예상 약속 시간
```

예:

```text
대학 친구 저녁

8/21 19:00
8/22 18:00
8/22 19:00
8/23 18:00

2시간
```

---

# 30. Guest Host

로그인하지 않은 사용자가 Meetup 생성 시:

```text
Firebase Anonymous Auth
```

자동 실행.

```text
createdByUid = anonymous uid
```

Participant:

```text
isHost = true
```

---

# 31. Invite

```text
🎉 약속이 만들어졌어요

대학 친구 저녁

친구들에게 공유해주세요.

aimasho.app/m/ABC123

[ LINE으로 공유 ]
[ 링크 복사 ]
[ 기타 공유 ]
```

---

# 32. Guest Join

Meetup 초대 링크를 처음 열면:

```text
대학 친구 저녁

성화님이 초대했어요.

이름을 알려주세요.

[ 이름 ]

[ 참여하기 ]
```

---

# 33. Candidate Slot

```ts
interface CandidateSlot {
  id: string;

  startDateTime: Timestamp;

  createdAt: Timestamp;
}
```

---

# 34. Schedule Voting

```text
○ 가능
△ 애매
× 불가능
```

Example:

| 일정         | 선택 |
| ---------- | -- |
| 8/21 19:00 | ○  |
| 8/22 18:00 | ○  |
| 8/22 19:00 | △  |
| 8/23 18:00 | ×  |

Web과 App 모두 큰 Touch Target.

---

# 35. Vote Model

```ts
interface AvailabilityVote {
  participantUid: string;

  slotId: string;

  status: "YES" | "MAYBE" | "NO";

  updatedAt: Timestamp;
}
```

Firestore:

```text
meetups/{meetupId}/votes/{uid}_{slotId}
```

---

# 36. Schedule Matrix

| 일정         | 성화 | 민수 | 유키 | 준 |
| ---------- | -- | -- | -- | - |
| 8/21 19:00 | ○  | ○  | △  | × |
| 8/22 18:00 | ○  | ○  | ○  | ○ |
| 8/22 19:00 | ○  | ○  | ○  | ○ |
| 8/23 18:00 | △  | ×  | ○  | ○ |

Firestore realtime listener 사용 가능.

---

# 37. Schedule Ranking

Weight:

```text
YES = 2
MAYBE = 1
NO = 0
```

Priority:

```text
1. NO 최소
2. YES 최대
3. Total Score 최대
4. 날짜가 빠른 순
```

최종 Ranking은 Backend Function에서 수행한다.

---

# 38. Schedule Recommendation UI

```text
✨ aimasho 추천

8월 22일 18:00

○ 4
△ 0
× 0

전원이 참석할 수 있어요.

[ 이 일정으로 결정 ]
```

Host Only.

---

# 39. Origin Input

일정 확정 후:

```text
📍 어디서 출발하나요?

모두에게 좋은 장소와
각자의 경로를 계산하는 데 사용돼요.

[ 역 / 장소 / 주소 검색 ]
```

Google Places 사용.

---

# 40. Registered User Origin

회원:

```text
기본 출발 위치
横浜駅
```

저장 가능.

새 Meetup:

```text
이번에도 横浜駅에서 출발하시나요?

[ 네 ]
[ 다른 위치 ]
```

Guest는 Meetup 단위로만 저장.

---

# 41. Location Privacy

다른 참가자에게 정확한 주소/좌표를 노출하지 않는다.

기본 표시:

```text
성화
출발 위치 등록 완료
```

또는 사용자 동의 시:

```text
横浜駅 주변
```

정도만 표시.

---

# 42. Meeting Place Mode

```text
어디서 만날까요?

[ ✨ 중간지점 추천 ]

[ 📍 직접 장소 정하기 ]
```

---

# 43. Middle Point Recommendation

단순 좌표 중앙점으로 최종 장소를 결정하지 않는다.

Process:

```text
각 Participant Origin
↓
Geographic Center
↓
주변 주요 역 탐색
↓
후보 5~10개
↓
Route Matrix
↓
Scoring
↓
Top 3
```

---

# 44. Meeting Point Modes

## FAIR

```text
⚖️ 공평하게
```

```text
평균 이동시간
+
이동시간 편차
+
최대 이동시간
```

고려.

Conceptual score:

```text
fairScore =
averageDuration
+
standardDeviation * 1.5
+
maxDuration * 0.25
```

---

## FAST

```text
⚡ 전체적으로 빠르게
```

```text
fastScore = averageDuration
```

Default:

```text
FAIR
```

---

# 45. Meeting Point Recommendation

```text
✨ 추천 만남 지역

🥇 渋谷駅

평균 이동
31분

최대 이동
46분

성화 33분
민수 28분
유키 21분
준 46분

[ 여기서 만나기 ]
```

---

# 46. Direct Place

```text
📍 직접 장소 정하기

[ 장소 검색 ]
```

가능한 결과:

```text
渋谷駅

渋谷スクランブルスクエア

代々木公園

Restaurant

Cafe
```

---

# 47. Route Calculation

예:

```text
Meetup Time
19:00

Target Arrival
18:50
```

기본:

```text
arrivalBufferMinutes = 10
```

---

# 48. Route Business Logic

각 Participant:

```text
Origin
↓
Meeting Place
```

Route 계산.

가능하면 Target Arrival Time 기반 Route 검색.

---

# 49. Participant Route

```ts
interface ParticipantRoute {
  participantUid: string;

  origin: Location;

  destination: MeetingPlace;

  durationMinutes: number;

  departureTime: Timestamp;

  arrivalTime: Timestamp;

  transfers?: number;

  routeSummary?: string;

  externalMapsUrl?: string;

  calculatedAt: Timestamp;
}
```

---

# 50. Route Overview

```text
🍻 대학 친구 저녁

8월 22일 19:00

📍 渋谷駅

목표 도착
18:50
```

| 참가자 |    출발 | 소요시간 |    도착 |
| --- | ----: | ---: | ----: |
| 성화  | 18:15 |  35분 | 18:50 |
| 민수  | 18:24 |  26분 | 18:50 |
| 유키  | 18:37 |  13분 | 18:50 |
| 준   | 18:02 |  48분 | 18:50 |

---

# 51. My Route

```text
🚃 18:15에 출발하세요

横浜駅
↓
渋谷駅

약 35분

18:50 도착 예정

[ 경로 자세히 보기 ]
```

---

# 52. External Navigation

aimasho가 전체 Navigation Engine을 구현하지 않는다.

MVP에서는:

```text
출발시간
도착시간
소요시간
간단 Route Summary
```

제공.

상세 Navigation:

```text
Google Maps 열기
```

---

# 53. Mobile Notification

Flutter App에서는 Push Notification 지원.

예:

```text
🚃 출발할 시간이에요

지금 출발하면
18:50쯤 渋谷駅에 도착해요.
```

---

# 54. Notification Scheduling

최종 Route 계산 후 Backend에서 Notification 정보를 생성.

필요 데이터:

```text
departureTime
participantUid
deviceToken
```

Firebase Cloud Messaging 사용.

Web Push는 MVP 필수 아님.

---

# 55. Meetup Day Screen

```text
오늘의 약속

🍻 대학 친구 저녁

19:00
渋谷駅

🚃 18:15 출발

18:50 도착 예정

[ 경로 보기 ]
```

---

# 56. Settlement

Expense Input:

```text
항목

금액

결제한 사람

같이 낼 사람
```

예:

```text
저녁
¥16,000

결제
성화

참여
☑ 성화
☑ 민수
☑ 유키
☑ 준
```

---

# 57. Expense

```ts
interface Expense {
  id: string;

  title: string;

  amount: number;

  paidByUid: string;

  participantUids: string[];

  createdAt: Timestamp;
}
```

---

# 58. Settlement Calculation

```text
Balance
=
Paid Amount
-
Expected Share
```

예:

```text
성화 +4500
민수 -2000
유키 -1500
준 -1000
```

---

# 59. Settlement Result

```text
민수 → 성화
¥2,000

유키 → 성화
¥1,500

준 → 성화
¥1,000
```

실제 송금 기능은 MVP에서 구현하지 않는다.

---

# 60. Settlement Backend

정산 결과는 Cloud Function에서 계산한다.

Function:

```text
calculateSettlement
```

Input:

```text
Meetup Expenses
Participants
```

Output:

```text
Balances
Transfers
```

---

# 61. Room

Registered User만 Room 생성 가능.

```text
대학교 친구들

성화
민수
유키
준

[ + 새로운 약속 ]
```

---

# 62. Room Invite

```text
aimasho.app/r/{inviteCode}
```

장기 Membership이므로 Account Conversion을 강하게 권장.

```text
「대학교 친구들」에 초대받았어요.

이 그룹에서는 다음 약속도
계속 함께 만들 수 있어요.

[ Google로 참여 ]
[ Apple로 참여 ]
```

---

# 63. Room Meetup

```text
대학교 친구들

+ 새로운 약속
```

↓

```text
누가 참가하나요?

☑ 성화
☑ 민수
☑ 유키
☑ 준
```

그 이후 기존 Standalone Meetup Flow 재사용.

---

# 64. No Friend System

MVP에서 구현 금지:

```text
친구 요청
친구 검색
Following
Follower
DM
SNS Feed
```

Room Membership만 존재.

---

# 65. Web Navigation

```text
/
  Landing / Home

/create
  Meetup Create

/m/{meetupId}
  Meetup Overview

/m/{meetupId}/schedule

/m/{meetupId}/origin

/m/{meetupId}/location

/m/{meetupId}/routes

/m/{meetupId}/expenses

/rooms

/rooms/{roomId}

/profile
```

---

# 66. Flutter Navigation

`go_router` 기준.

```text
/

/create

/meetup/:meetupId

/meetup/:meetupId/schedule

/meetup/:meetupId/origin

/meetup/:meetupId/location

/meetup/:meetupId/routes

/meetup/:meetupId/expenses

/rooms

/room/:roomId

/profile
```

Deep Link와 동일 의미 유지.

---

# 67. UI Sharing Policy

Web과 Flutter 사이에서 UI Component 자체는 공유하지 않는다.

공유하지 않는 것:

```text
React Component
Flutter Widget
Navigation
Platform-specific layout
```

공유해야 하는 것:

```text
Firestore Schema

API Contract

Enum 정의 의미

Business Rules

Function Request/Response Schema

Product Copy Meaning
```

---

# 68. API Contract Documentation

Web과 Flutter가 서로 다른 언어를 사용하므로 Backend Function의 Request/Response를 명시적으로 관리한다.

예:

```json
POST calculateMeetingPoints

{
  "meetupId": "abc123",
  "mode": "FAIR"
}
```

Response:

```json
{
  "candidates": [
    {
      "placeId": "...",
      "name": "渋谷駅",
      "averageDurationMinutes": 31,
      "maxDurationMinutes": 46,
      "score": 42.1
    }
  ]
}
```

TypeScript와 Dart Model을 각각 작성한다.

---

# 69. Firebase Security Rules

필수.

Rules:

```text
모든 Write는 Firebase Auth 필요

Anonymous Auth도 Authenticated User로 인정

Participant만 Meetup Data 접근 가능

자신의 Vote만 변경

자신의 Origin만 변경

Host Only:
- 일정 확정
- 장소 확정
- Meetup 종료

Room Owner:
- Room 관리
```

Client에서 전달된:

```text
isHost
```

를 신뢰하지 않는다.

Firestore 기준으로 검증한다.

---

# 70. Google API Security

Google Maps 관련 Server API Key는 Client에 직접 노출하지 않는다.

Backend:

```text
Cloud Functions
```

통해서:

```text
Routes
Route Matrix
일부 Places Server Calls
```

처리.

Client SDK용 제한된 Key가 필요한 경우:

```text
iOS Bundle ID 제한
Android Package/SHA 제한
Web Domain 제한
```

을 사용한다.

---

# 71. Provider Layer

Backend:

```ts
interface RoutingProvider {
  calculateRoute(input: RouteInput): Promise<RouteResult>;

  calculateMatrix(
    origins: Location[],
    destinations: Location[]
  ): Promise<RouteMatrixResult>;
}
```

Implementations:

```text
GoogleRoutingProvider
MockRoutingProvider
```

Places:

```text
GooglePlacesProvider
MockPlacesProvider
```

---

# 72. Mock Mode

Google API를 아직 연결하지 않아도 UI 개발 가능해야 한다.

Firebase Functions 환경 설정:

```text
USE_MOCK_MAPS=true
```

Mock:

```text
横浜
吉祥寺
新宿
千葉

→

渋谷
新宿
東京
```

---

# 73. Web Design

Mobile-first.

Maximum width:

```text
600~720px
```

Keywords:

```text
Friendly
Warm
Minimal
Social
Playful
Fast
```

---

# 74. Flutter Design

Web Brand와 동일한 Design Language 사용.

단, Flutter에서는 Native Mobile Interaction을 존중한다.

예:

```text
Bottom Sheet
Swipe
Native-like Navigation
Large Touch Targets
Safe Area
Haptic Feedback 가능
```

---

# 75. Brand Direction

Primary:

```text
Warm Coral / Orange
```

Background:

```text
Warm Off-white
```

Vote:

```text
○ Green
△ Yellow / Orange
× Red
```

Radius:

```text
16~24px
```

---

# 76. Language

초기 Target:

```text
Japan
```

기본 UI:

```text
Japanese
```

Code:

```text
English
```

향후:

```text
Japanese
Korean
English
```

확장 가능하게 String을 Widget/Component에 과도하게 하드코딩하지 않는다.

---

# 77. Error State

예:

```text
경로를 계산하지 못했어요.

[ 다시 시도 ]
```

중간지점:

```text
추천 장소를 찾지 못했어요.

[ 직접 장소 선택 ]
```

---

# 78. Loading State

```text
✨ 모두에게 좋은 장소를 찾고 있어요...
```

```text
🚃 각자의 이동시간을 계산하고 있어요...
```

---

# 79. Empty State

Votes:

```text
아직 아무도 응답하지 않았어요.

친구들에게 링크를 공유해주세요.
```

Room:

```text
아직 모임이 없어요.

[ 첫 모임 만들기 ]
```

Expenses:

```text
아직 등록된 비용이 없어요.

[ 비용 추가 ]
```

---

# 80. MVP 제외 기능

Codex는 다음 기능을 임의로 추가하지 않는다.

```text
Calendar 연동

친구 요청

SNS

DM

채팅

실시간 위치 공유

실시간 친구 Tracking

식당 예약

실제 송금

AI Chat

자동 반복 일정

복잡한 Social 기능
```

---

# 81. Development Strategy

Web과 Flutter를 동시에 진행한다.

Feature 단위 개발.

잘못된 방식:

```text
Web 전체 완성
↓
Flutter 재구현
```

사용할 방식:

```text
                Web       Flutter

Auth             ✅          ✅

Meetup           ✅          ✅

Scheduling       ✅          ✅

Origin           ✅          ✅

Location         ✅          ✅

Routing          ✅          ✅

Settlement       ✅          ✅

Room             ✅          ✅
```

---

# 82. Definition of Done

Feature가 완료됐다고 판단하려면:

```text
Backend 구현
+
Web 구현
+
Flutter 구현
+
Security 검증
+
Test
```

가 모두 완료되어야 한다.

예외:

```text
Web-only Guest SEO / Browser 기능

App-only Push Notification
```

처럼 플랫폼 전용 기능.

---

# 83. Phase 0 — Project Setup

구현:

```text
web/

mobile/

functions/

firebase/
```

Firebase Project 연결.

Web 실행 확인.

Flutter iOS 실행 확인.

Flutter Android 실행 확인.

Cloud Functions Emulator 확인.

Firestore Emulator 확인.

---

# 84. Phase 1 — Authentication

Web:

```text
Anonymous Auth

Google Sign-In

Auth State
```

Flutter:

```text
Anonymous Auth

Google Sign-In

Auth State
```

Apple은 이후 같은 Phase 내 추가 가능.

Anonymous → Registered Account Linking 구현.

---

# 85. Phase 2 — Meetup Core

Web + Flutter:

```text
Meetup Create

Guest Host

Invite Link

Guest Join

Participant

Meetup Overview
```

Deep Link 기본 구조 구현.

---

# 86. Phase 3 — Scheduling

Web + Flutter:

```text
Candidate Slot

○△× Vote

Vote Matrix

Schedule Ranking Backend

Recommendation

Host Schedule Confirm
```

---

# 87. Phase 4 — Origin

Web + Flutter:

```text
Location Search

Origin Save

Registered User Default Origin
```

---

# 88. Phase 5 — Meeting Point

Backend:

```text
Candidate Station

Route Matrix

FAIR Ranking

FAST Ranking
```

Web + Flutter:

```text
Recommendation UI

Direct Location Search
```

---

# 89. Phase 6 — Routes

Backend:

```text
Route Calculation

Target Arrival

Departure Time
```

Web + Flutter:

```text
Route Overview

My Route

Google Maps Link
```

Flutter 추가:

```text
Departure Push Notification
```

---

# 90. Phase 7 — Settlement

Backend:

```text
Expense Balance

Transfer Optimization
```

Web + Flutter:

```text
Expense Create

Expense List

Settlement Result
```

---

# 91. Phase 8 — Room

Web + Flutter:

```text
Room Create

Room Invite

Room Members

Room Meetup

Previous Meetup
```

---

# 92. Phase 9 — Polish

```text
Universal Link

Android App Link

Responsive Web

Flutter UX

Loading

Error

Empty

Account Conversion

Push Notification
```

---

# 93. First Implementation Milestone

처음부터 전체 서비스를 구현하지 않는다.

Codex 첫 작업:

```text
Phase 0
+
Phase 1
+
Phase 2
+
Phase 3
```

까지만 완료한다.

---

# 94. First Milestone Scenario

## Host

Web 또는 Flutter에서:

```text
회원가입 없이
aimasho 실행

↓

약속 만들기

↓

Anonymous Auth

↓

대학 친구 저녁

↓

후보 생성

8/21 19:00
8/22 18:00
8/22 19:00
8/23 18:00

↓

Meetup 생성

↓

Invite Link
```

---

## Guest

다른 Browser 또는 App:

```text
Invite Link 열기

↓

Anonymous Auth

↓

이름 입력

↓

Participant 생성

↓

○△× Vote
```

---

## Result

```text
4명의 Vote Matrix

↓

8/22 19:00 추천

↓

Host 일정 확정
```

---

# 95. Cross-platform Validation

다음 경우도 동작해야 한다.

```text
Host = Flutter

Guest A = Web

Guest B = Flutter iOS

Guest C = Web Incognito
```

모두 동일 Meetup에서 Vote 가능.

Firestore 데이터가 실시간으로 일관되어야 한다.

---

# 96. Test Strategy

## Backend Unit Test

```text
Schedule Ranking

Meeting Point FAIR

Meeting Point FAST

Target Arrival

Settlement Balance

Settlement Optimization
```

---

## Web

```text
TypeScript Test

Component Test

E2E
```

최소 E2E:

```text
Create
→ Join
→ Vote
→ Confirm
```

---

## Flutter

```text
Dart Unit Test

Widget Test
```

최소:

```text
Vote Screen

Meetup State

Auth State
```

---

# 97. Quality Gates

Web:

```text
npm run lint

npm run typecheck

npm test

npm run build
```

Flutter:

```text
flutter analyze

flutter test

flutter build apk
```

가능한 환경에서는:

```text
flutter build ios --no-codesign
```

도 확인.

Functions:

```text
npm run lint

npm test

npm run build
```

---

# 98. Coding Rules

1. 이 문서를 Product Source of Truth로 사용한다.

2. Web과 Flutter를 Feature 단위로 함께 구현한다.

3. Web UI와 Flutter UI 코드를 공유하려 하지 않는다.

4. 중요한 Business Logic을 Client마다 중복 구현하지 않는다.

5. 핵심 계산은 Backend를 Source of Truth로 한다.

6. TypeScript strict mode 사용.

7. Dart analyzer warning 최소화.

8. Web Firebase 코드와 UI를 분리한다.

9. Flutter Firebase 코드와 Widget을 분리한다.

10. Repository / Service Layer를 둔다.

11. Firestore Security Rules를 실제 구현한다.

12. Host 권한을 UI만으로 검사하지 않는다.

13. Guest에게 회원가입을 강제하지 않는다.

14. Calendar 관련 기능을 구현하지 않는다.

15. Google API Key를 무방비로 노출하지 않는다.

16. Location 정보를 민감 데이터로 취급한다.

17. Deep Link URL은 처음부터 고정한다.

18. Backend Request/Response Contract를 문서화한다.

19. 각 Phase 완료 시 테스트를 실행한다.

20. 플랫폼 간 기능 동작이 다르면 문서화한다.

---

# 99. Privacy

Origin은 다른 참가자에게 상세 노출하지 않는다.

```text
Exact address
Latitude
Longitude
```

는 Route Calculation 용도.

회원만 Default Origin을 저장할 수 있다.

Guest Origin은 Meetup 단위.

향후 삭제 기능 추가 가능한 구조로 한다.

---

# 100. Product Success Scenario

가장 중요한 경험:

```text
친구가 LINE에 링크 전송

↓

링크 클릭

↓

앱이 없으면 Web

앱이 있으면 Flutter App

↓

이름 입력

↓

○△× 선택

↓

가장 좋은 날짜 결정

↓

각자 출발 위치 입력

↓

중간에서 만나거나
직접 장소 선택

↓

"나는 18:15에 나가면 되는구나"

↓

모두 비슷한 시간에 도착

↓

정산

↓

끝
```

---

# 101. Core Product Message

## Japanese

**みんなの「いつ・どこ・何時に出る？」を、ひとつに。**

Alternative:

**予定を合わせて、場所を合わせて、会いましょう。**

## Internal Product Definition

**약속을 잡는 것에서 끝나지 않고, 실제로 만날 때까지 연결한다.**

---

# 102. Codex First Prompt

이 문서를 전체 Product Specification으로 사용한다.

첫 번째 구현에서는 Phase 0~3만 구현한다.

반드시:

```text
Next.js Web
Flutter iOS/Android
Firebase Authentication
Cloud Firestore
Firebase Cloud Functions
```

를 하나의 Firebase Project에 연결한다.

첫 Milestone은 다음 Cross-platform Scenario가 동작하는 것이다.

```text
Flutter Host가 Meetup 생성
↓
Web Guest가 Invite Link로 참가
↓
Flutter Guest가 참가
↓
모두 ○△× Vote
↓
Web / Flutter 모두 동일 결과 표시
↓
Host가 일정 확정
```

Google Maps, Route, Settlement, Room은 이 Milestone에서 구현하지 않는다.

다만 이후 Phase에서 추가할 수 있도록 데이터 모델과 구조를 깨뜨리지 않게 설계한다.

A feature is considered complete only when the Backend, Web implementation, and Flutter implementation are all functional, unless the feature is explicitly platform-specific.
