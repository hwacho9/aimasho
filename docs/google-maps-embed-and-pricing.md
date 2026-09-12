# Google 지도 표시와 Places 비용 운영 가이드

갱신일: 2026-09-12 (Google Maps Platform 글로벌 USD 가격표 기준)

이 문서는 aimasho의 장소 검색, 장소 상세 정보, 웹 지도 미리보기의 키 분리와 비용을 설명한다. API 키 값·Firebase 키·FCM 토큰은 문서나 Git에 기록하지 않는다.

## 현재 동작

| 사용자가 하는 일 | aimasho의 호출 | 현재 과금 범주 |
| --- | --- | --- |
| 장소 검색 버튼 선택 | Places API (New) `places:searchText` | Places API Text Search Pro |
| `평점·영업시간 보기` 선택 | Places API (New) Place Details | Places API Place Details Enterprise |
| 장소 카드의 Google 지도 보기 | Maps Embed API iframe | Embed (무료) |
| 출발 경로 계산 | Routes API `computeRoutes` | Compute Routes Essentials 예정 |

출발 경로 계산은 현재 화면에서 비활성화되어 있으므로 일반 사용 흐름으로는 Routes API 요청이 발생하지 않는다. 장소 상세 정보는 카드가 열릴 때 자동 호출하지 않고, 사용자가 상세 버튼을 누른 경우에만 서버에서 조회한다.

장소 검색은 `id`, `displayName`, `formattedAddress`, `location`만 요청한다. 장소 상세는 평점·현재/정규 영업시간·가격대·전화·웹사이트를 제공하기 위해 Enterprise 필드를 요청한다. 사진·리뷰·생성형 요약 같은 Enterprise + Atmosphere 필드는 요청하지 않는다.

## Maps Embed API 설정

Maps Embed API는 iframe을 통해 웹에 Google 지도를 표시하는 용도다. 서버에서 Places/Routes를 호출하는 키와 반드시 분리한다.

1. Google Cloud Console에서 프로젝트 `aimasho`를 선택하고 Billing 연결 상태를 확인한다.
2. **API 및 서비스 → 라이브러리 → Maps Embed API**에서 API를 사용 설정한다.
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**를 선택한다.
4. 키 이름을 `aimasho-web-maps-embed`처럼 용도를 알 수 있게 지정한다.
5. **애플리케이션 제한사항**을 `웹사이트`로 설정하고 운영 도메인만 추가한다.

   ```text
   https://aimasho.web.app/*
   ```

   로컬 개발은 별도 개발용 키를 만들어 `http://localhost:*/*`로 제한하는 편이 안전하다. 운영 키에 넓은 와일드카드나 모든 앱 허용을 사용하지 않는다.

6. **API 제한사항**을 `키 제한`으로 바꾸고 `Maps Embed API`만 선택한 뒤 저장한다.
7. 로컬에서만 관리하는 `web/.env.local`에 아래 값을 추가한다.

   ```dotenv
   NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=브라우저용_제한_키
   ```

8. Next.js는 `NEXT_PUBLIC_*` 값을 빌드 시 브라우저 번들에 넣으므로 웹을 다시 배포한다.

   ```sh
   npm --prefix web run check
   npm run deploy:web
   ```

`NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`는 브라우저에서 보이는 값이다. 이것은 의도된 브라우저 키이므로 도메인·API 제한이 필수다. `functions/.env`의 `GOOGLE_MAPS_SERVER_API_KEY`나 Firebase API 키를 이 변수에 복사하면 안 된다.

키가 설정되면 저장한 Place ID로 `https://www.google.com/maps/embed/v1/place` iframe을 생성한다. 키가 없거나 기존 장소에 좌표만 있으면 카드 안에서 OpenStreetMap 미리보기를 보여주고, 사용자가 원하는 경우에만 외부 Google Maps 링크를 연다.

## 가격과 예산 예시

아래 가격은 글로벌 가격표의 월별 무료 사용량 이후 1,000 이벤트당 가격이다. 세금·환율·계약 할인은 포함하지 않는다. 가격과 무료 한도는 바뀔 수 있으므로 배포 전에 Google Cloud Billing 화면도 확인한다.

| SKU | 무료 월간 한도 | 이후 단가 |
| --- | ---: | ---: |
| Maps Embed | 무제한 | $0 |
| Places API Text Search Pro | 5,000 | $32 / 1,000 |
| Places API Place Details Enterprise | 1,000 | $20 / 1,000 |
| Routes: Compute Routes Essentials | 10,000 | $5 / 1,000 |

예를 들어 한 달에 장소 검색 10,000회와 장소 상세 조회 3,000회가 있으면 지도 표시와 경로 계산을 제외한 예상 사용료는 다음과 같다.

```text
Text Search:    (10,000 - 5,000) / 1,000 × $32 = $160
Place Details:  ( 3,000 - 1,000) / 1,000 × $20 =  $40
합계: 약 $200 / 월 (세금 제외)
```

지도 iframe은 이 계산에 비용을 더하지 않는다. 다만 Maps Embed API도 유효한 API 키와 Billing 계정은 필요하다.

## 실제 비용 확인과 제한

Google Cloud Console의 **Billing → Reports**에서 프로젝트 `aimasho`를 선택하고 다음 SKU를 각각 확인한다.

- `Places API Text Search Pro`
- `Places API Place Details Enterprise`
- `Routes: Compute Routes Essentials`
- `Embed` (비용은 $0으로 표시될 수 있음)

처음에는 Billing 예산 알림을 $10, $30, $100처럼 단계적으로 만든다. 예산 알림은 비용을 자동으로 차단하지 않으므로, 비용 상한이 꼭 필요하면 API별 할당량과 사용 흐름도 함께 관리해야 한다. Places 상세 버튼을 자동 조회로 바꾸거나 사진·리뷰를 추가하기 전에는 이 문서의 SKU 등급을 다시 확인한다.

## 공식 자료

- [Maps Embed API 시작하기](https://developers.google.com/maps/documentation/embed/quickstart)
- [Maps Embed API iframe·Place ID 설정](https://developers.google.com/maps/documentation/embed/embedding-map)
- [Places API 필드별 SKU](https://developers.google.com/maps/documentation/places/web-service/data-fields)
- [Google Maps Platform 가격표](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Routes API 사용량·과금](https://developers.google.com/maps/documentation/routes/usage-and-billing)
