# aimasho.web.app 배포 방법

운영 주소: **https://aimasho.web.app/**

최근 웹 배포: 2026-09-12 JST, Cloud Run `aimasho-web-release-20260912023505`. 일정의 선택 장소 카드에 인라인 지도와 요청 시 조회하는 장소 상세 정보(평점·영업시간·가격대·전화·웹사이트)를 반영했습니다. `getPlaceDetails` Functions API는 ACTIVE이고, `aimasho.web.app`의 데스크톱·모바일 폭 브라우저 스모크 테스트를 통과했습니다.

## 현재 구조

```text
aimasho.web.app (Firebase Hosting)
  └─ firebase.json의 rewrite
      └─ aimasho-web (Cloud Run / asia-east1 / Next.js)

웹·iOS 앱 → Cloud Functions (asia-northeast1) → Firestore
```

Firebase Hosting을 사용합니다. 다만 Next.js 서버가 필요하므로 Hosting이 Cloud Run으로 요청을 전달합니다. `hosting/`에는 정적 안내 파일만 있으며 앱 본체가 아닙니다.

**`firebase deploy --only hosting`만 실행하면 Next.js 코드는 갱신되지 않습니다.** App Hosting의 GitHub rollout과도 별개입니다. 이 문서는 현재 체크아웃의 코드를 기존 `aimasho-web`에 직접 배포합니다. Git 커밋·push는 자동으로 하지 않습니다. App Hosting 자동 rollout을 동시에 실행하면 같은 서비스에 다른 버전이 올라갈 수 있으므로 중복 배포하지 마세요.

## 1. 준비

프로젝트 루트(`/Users/chosunghwa/Desktop/workspace/aimasho`)에서 실행합니다.

```sh
node --version
npm ci
npm --prefix functions ci
npm --prefix web ci
npx firebase login
gcloud auth login
```

- Node.js 22.13 이상 또는 24, Google Cloud CLI가 필요합니다.
- Firebase CLI는 이 저장소의 로컬 버전(`npx firebase`, npm scripts)을 사용하세요.
- 프로젝트는 `aimasho`로 고정됩니다. `.firebaserc`의 기본값도 `aimasho`입니다.
- Blaze 요금제 및 Cloud Build / Cloud Run / Artifact Registry / Cloud Functions 사용 권한이 필요합니다. Cloud Build와 서버 사용에는 비용이 발생할 수 있습니다.
- 기존 Artifact Registry 저장소: `asia-east1-docker.pkg.dev/aimasho/firebaseapphosting-images`.

## 2. 환경 설정

`web/.env.example`을 기준으로 `web/.env.local`에 운영 Firebase **Web 앱** 설정을 입력합니다.

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase Web 앱 API 키>
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase Web 앱 ID>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=aimasho.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=aimasho
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<Firebase 콘솔 값>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=656790983004
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<선택>
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=<지도 미리보기용 브라우저 키, 선택>
```

`<선택>` 표기를 그대로 넣지 마세요. 사용하지 않는 항목은 비워 둡니다.

- 배포 스크립트는 Web 공개 설정만 별도 임시 빌드 폴더에 복사합니다. `.env.local` 원본, 모바일, 테스트, Functions 비밀키는 웹 소스로 업로드하지 않습니다.
- 테스트 프로젝트 또는 Emulator가 설정되어 있으면 웹 배포를 중단합니다.
- `NEXT_PUBLIC_*`는 브라우저 번들에 포함됩니다. **서버 비밀키를 절대 넣지 마세요.**
- 실제 Places 검색: `functions/.env`의 `USE_MOCK_MAPS=false`, 서버 전용 `GOOGLE_MAPS_SERVER_API_KEY`를 설정합니다. 키 값을 문서·Git·로그에 남기지 마세요.
- 지도 미리보기는 Maps Embed API 전용 브라우저 키를 별도로 사용합니다. 해당 키에는 웹사이트 referrer/API 제한을 적용하세요. 키가 미설정이어도 카드 안에 OpenStreetMap 지도가 표시되며, 필요하면 외부 Google Maps 링크도 사용할 수 있습니다.
- Firebase Authentication → 설정 → 승인된 도메인에 `aimasho.web.app`, Google 제공업체 활성화를 확인합니다.

## 3. 검증 후 전체 배포

```sh
npm test
npm --prefix web audit --omit=dev
npm run deploy
```

`npm run deploy` 실행 순서:

1. Web/Functions lint·타입 검사 및 Functions 빌드.
2. `functions,firestore` 배포: 새 소셜 API와 Firestore 규칙·인덱스 포함.
3. Web 소스를 Cloud Build의 Linux Docker 환경에서 빌드.
4. `aimasho-web`에 새 리비전을 **운영 트래픽 없이** 생성.
5. 새 리비전 URL의 `/`, `/login`, `/profile`, `/journey`가 HTTP 200 및 Next.js HTML을 반환하는지 검사.
6. 검사 성공 시에만 새 리비전으로 트래픽을 100% 전환.
7. Firebase Hosting 설정 배포.

단계별로 실행하려면:

```sh
npm run check
npm run deploy:backend
npm run deploy:web
npm run deploy:hosting
```

웹만 수정한 경우 `npm run deploy:web` 후 `npm run deploy:hosting`을 실행합니다. API·데이터 구조가 바뀌었다면 먼저 백엔드도 배포해야 합니다. 명령이 실패하면 원인을 수정한 후 실패한 단계부터 재실행하세요. `--force`로 기존 함수를 삭제하지 마세요.

Docker가 로컬에서 실행 중일 필요는 없습니다. 클라우드에서 빌드합니다. 빌드에 업로드할 파일만 미리 준비하려면 `node scripts/deploy-web.mjs --prepare`를 사용할 수 있습니다(배포하지 않음).

## 4. 운영 확인

```sh
curl -I https://aimasho.web.app/
curl -I https://aimasho.web.app/profile
gcloud run services describe aimasho-web --project aimasho --region asia-east1 \
  --format='value(status.latestReadyRevisionName)'
```

브라우저에서 아래도 확인합니다. HTTP 200만으로 로그인/데이터 조회 성공까지 보장하지는 않습니다.

- 로그인 → 새로고침 → 홈에 일정 보드 표시.
- 홈의 `マイグループ` → 그룹방 이동. `グループの作成・参加`에서 만든 그룹과 참여한 그룹도 홈에 표시되는지 확인.
- 초대 링크로 참여 → 서로 친구 목록에 표시.
- 날짜 확정 → 플랜과 장소 저장 → 호스트가 `予定を完了` → 친구별 완료 횟수·공통 일정·Journey 확인.
- 상대의 비공개 일정 전체가 아닌 **공유한 일정만** 보여야 합니다.

자동 E2E 재실행 방법과 검증 범위는 [E2E 보고서](docs/e2e-social-flow.md)를 참고하세요. 로컬 E2E는 `demo-aimasho-e2e`를 사용하며 운영 사용자/모임을 만들지 않습니다.

## 5. 되돌리기

웹 배포 성공 시 `.firebase/last-web-release.json`에 이전/신규 리비전과 이미지가 저장됩니다(Git 제외). 이전 **운영 트래픽 리비전**을 확인한 후:

```sh
gcloud run services update-traffic aimasho-web --project aimasho --region asia-east1 \
  --to-revisions=<확인한_이전_운영_리비전>=100
```

이 명령은 웹만 되돌립니다. Functions·Firestore 규칙은 검증된 이전 소스에서 별도로 재배포해야 합니다. Firestore 데이터는 배포/웹 롤백으로 복원되거나 삭제되지 않습니다.

2026-09-09 배포 점검에서는 Next.js를 15.5.25로 갱신하고 Next 내부 PostCSS를 8.5.28로 고정하여 운영 의존성의 알려진 보안 경고를 해소했습니다. 이후 배포에서도 audit 결과를 확인하고, `npm audit fix --force`로 메이저 버전을 자동 변경하지 마세요.

## iOS 주의

Firebase 웹 배포는 iPhone 앱을 배포하지 않습니다. iOS 변경은 `mobile/`에서 새로 빌드해야 합니다. 2026-09-09 확인 시 Firebase에는 Web 앱만 등록되어 있고, 로컬 `mobile/firebase.env.json`의 운영 필수값은 비어 있었습니다. 실제 Google 로그인에는 iOS 앱 등록, 올바른 Bundle ID, Firebase iOS 설정, Google OAuth client ID 및 URL scheme이 추가로 필요합니다. [모바일 설정](mobile/README.md)을 참고하세요.

## 공식 문서

- [Firebase Hosting과 Cloud Run 연동](https://firebase.google.com/docs/hosting/cloud-run)
- [Cloud Run 컨테이너 배포](https://docs.cloud.google.com/run/docs/deploying)
- [Next.js standalone 출력](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
