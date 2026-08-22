# Google Calendar 개인 일정 겹침 확인 설정

aimasho의 캘린더 기능은 각 사용자가 버튼을 눌렀을 때만 Google Calendar의 **읽기 전용** 권한을 요청합니다. 일정 제목·시간·토큰은 Firebase, Cloud Functions, Firestore에 저장하거나 다른 참가자에게 전송하지 않습니다. 브라우저 탭을 새로 고치거나 `캘린더 숨기기`를 누르면 화면의 일정 데이터도 지워집니다.

## 1. Calendar API 사용 설정

1. [Google Cloud Console API 라이브러리](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)에서 Firebase 프로젝트 **aimasho**를 선택합니다.
2. **Google Calendar API**를 찾아 **사용 설정**을 누릅니다.
3. 적용에는 몇 분이 걸릴 수 있습니다.

`Calendar API`와 `Google Calendar API`는 이 기능에서 같은 API를 뜻합니다. Places/Routes API 키 설정과는 별개이며, 별도의 서버 API 키는 필요하지 않습니다.

## 2. Google 로그인 확인

1. Firebase Console → **Authentication** → **Sign-in method**에서 **Google** 제공업체가 사용 설정되어 있는지 확인합니다.
2. Authentication → **Settings** → **Authorized domains**에 다음을 넣습니다.
   - `aimasho.web.app`
   - `aimasho.firebaseapp.com`
   - 로컬 테스트 시 `localhost`
   - 사용할 맞춤 도메인(예: `aimasho.app`)
3. Google Cloud Console → **Google Auth Platform** → **Audience**에서 OAuth 동의 화면의 공개 상태를 확인합니다.
   - 테스트 상태라면, 실제로 로그인할 Google 계정을 **Test users**에 추가합니다.
   - 공개 서비스 전환은 Google의 OAuth 검토 대상이 될 수 있습니다. 여기서는 사용자가 자신의 캘린더를 읽는 `calendar.events.readonly` 범위만 요청합니다.

## 3. 앱에서 테스트

1. Google 계정으로 aimasho에 로그인합니다. 익명으로 시작했다면 `Google Calendar 연결`을 누르는 과정에서 같은 계정으로 업그레이드됩니다.
2. 약속의 일정 조율 화면에서 **Google Calendar 연결**을 누릅니다.
3. 팝업에 표시되는 `Google Calendar 보기` 권한을 허용합니다.
4. 후보 시간마다 `겹치는 내 일정 n개` 또는 `등록된 내 일정과 겹치지 않음`이 표시되는지 확인합니다.

## 오류별 확인

| 화면/오류 | 확인할 것 |
| --- | --- |
| `Google Calendar API (403)` | 1단계에서 **aimasho 프로젝트**의 Google Calendar API를 활성화했는지 확인합니다. |
| `auth/unauthorized-domain` | 현재 접속한 도메인을 Firebase Authentication Authorized domains에 추가합니다. |
| 팝업이 닫힘 | 브라우저 팝업 차단을 해제하고 다시 연결합니다. |
| 테스트 사용자 제한 | OAuth 동의 화면의 Test users에 로그인 계정을 추가합니다. |
| 잘못된 계정으로 연결 | Google 계정의 연결 권한을 해제한 뒤 다시 연결하거나, 시크릿 창에서 원하는 계정으로 로그인합니다. |

## 개인정보 원칙

- 일정 겹침 계산은 사용자의 브라우저에서만 수행합니다.
- 투표·일정 후보·당일 플랜 등 약속 데이터와 Google Calendar 일정은 분리되어 있습니다.
- 권한 해제는 Google 계정의 [서드 파티 액세스 관리](https://myaccount.google.com/permissions)에서도 할 수 있습니다.

참고: [Firebase Google 로그인](https://firebase.google.com/docs/auth/web/google-signin), [Google Calendar Events: list](https://developers.google.com/calendar/api/v3/reference/events/list)
