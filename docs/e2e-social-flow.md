# ソーシャル機能 E2E 検証

## 友だちになる条件と現在の制限

- 独立した「友だち申請 → 承認」機能はまだありません。
- **登録ユーザー同士が同じ予定に参加すると**、お互いの友だち一覧に表示されます。完了前でも表示されます。
- グループ加入だけではソーシャル一覧の友だちは増えません。グループの共通予定が必要です。
- ゲストは予定に参加できますが、登録済み友だちとしては数えません。
- ホストが日程を確定し、予定を完了すると「完了した共通予定」が増えます。不参加回答は除外します。実際の出席証明ではありません。
- 友だちの予定は **ふたりが参加した共通予定のみ**。相手の非公開カレンダー全体は開示しません。
- Journey は完了した予定に保存された場所をつなぐ再生ビューです。GPS 履歴・実際の交通経路・動画ファイルの書き出しではありません。

## 2026-09-08 の確認結果

| 対象 | 結果 | 検証範囲 |
| --- | --- | --- |
| ローカル Auth → HTTP Callable → Firestore | PASS | 47 リクエスト、2 登録ユーザー + ゲスト + 外部ユーザー |
| デスクトップ Web / Chromium / 1440px | PASS | 2 ユーザーによる画面操作、招待・プラン・完了・相互の記録・Journey 再生 |
| モバイル幅 Web / Chromium / 390px | PASS | 同じフロー、横スクロール検査。iOS Safari 実機の検証ではない |
| iOS / iPhone 17 Pro / iOS26.5 シミュレーター | PASS | 招待参加 → 新規予定 → 日程確定 → プラン追加 → 完了 → 友だち履歴 → Journey 再生/一時停止 |

Web は実際の Next.js アプリを使います。`tests/preview` のモック画面は E2E の対象ではありません。Google ボタンから Auth Emulator のローカル認証画面を操作します。Google 本番 OAuth の審査・実アカウント認証は対象外です。

Web の検証: ログイン、再読み込み後のログイン維持、A の予定作成、招待リンクから B が参加、再訪時の名前入力スキップ、日程確定、A/B のプラン追加、場所選択、完了状態の同期、B の未確定予定に A が参加、双方の友だち一覧・完了回数・共通予定、Journey 再生/一時停止。

サーバーの追加検証: ゲスト除外、外部ユーザー拒否、ホスト以外の確定/完了拒否、投票変更、未確定予定の一覧、二重参加/完了による重複防止、非公開予定の混入防止、完了後の編集禁止、思い出の作成/編集/削除。

### スクリーンショットの読み込みエラー

本番 `aimasho` のデプロイ済み関数を読み取り専用で確認したところ、`getMySocialOverview` / `getMyMeetups` / `getMeetupMemories` / `saveMeetupMemory` / `getMyTravelTimeline` がありませんでした。`getFriendHistory` はありました。

したがって「友だちが 0 人」の状態ではなく、**新しい Web から未デプロイのソーシャル API を呼んでいる**ことが直接の原因でした。2026-09-09 のユーザー承認後、Functions・Firestore ルール/インデックス・Cloud Run の Web・Firebase Hosting をデプロイしました。本番の予定や友だちレコードの作成/変更は行っていません。

### 所要時間

ローカル API 47 呼び出し: 中央値 21ms / p95 587ms / 初回 saveProfile 1535ms。Web 2 ケース: 合計 31.3 秒。iOS 最終実行: ビルド22.4秒、テスト16秒、1ケース成功（初回のネイティブ依存ビルドは345.6秒）。これはローカル環境であり、本番の通信・コールドスタート・端末速度を保証する値ではありません。

Web lint / TypeScript と既存の33テスト、Functions lint/build と33テスト、Flutter analyze と11テストも成功しました。実行環境: Playwright1.63、Flutter3.24.4 / Dart3.5.4、Firebase CLI15.26.0。

## 2026-09-09: ホームのグループ表示

- Web / Flutter のホームと友だちタブに、作成したグループ・参加したグループ、管理者/メンバーの役割、グループ画面へのリンクを追加。
- 「グループの作成・参加」は既存のプロフィール画面へ移動。ダッシュボードの取得済みグループを再利用し、グループ表示のための API リクエストは増やしていません。
- 友だち API が失敗してもグループは独立して表示。Web の読み込み中・空状態も区別します。
- Web 36テスト、Flutter 14テスト、lint/typecheck/analyze が成功。長いグループ名・320px幅・文字1.5倍も Flutter で確認。
- Web E2E: グループ作成 → ホームに表示 → グループ画面へ移動を追加。1440px / 390px とも成功（合計30.5秒）。
- Web を `aimasho-web-release-20260908151920` へ更新し、Firebase Hosting の `aimasho.web.app` に反映。新しいグループ表示の JavaScript 配信と4ページ×2画面幅の基本接続検査も成功。
- Flutter はグループ作成/参加後にホームのデータを更新。グループ画面の初期読み込み・Google連携後・更新操作で `setState` が `Future` を返す既存のデバッグエラーも修正。
- iOS E2E 再検証成功（ビルド23.2秒、テスト33秒）: ホーム → プロフィールでグループ作成 → 戻ったホームに即反映 → グループ画面へ移動。その後の招待・プラン2地点・完了・友だち・Journey 再生も成功。Google 本番 OAuth ではなくローカル Emulator での検証です。

## 再実行

前提: Node.js 22.13+ または 24、Java 21+、Flutter、Xcode と iOS シミュレーター。リポジトリにインストールされた Firebase CLI を使ってください。古い `/usr/local/bin/firebase` では Functions v7 と互換性がなく、関数実行時に `functions.config()` エラーになりました。

プロジェクトルートのターミナル 1:

```sh
npm install
PATH=/opt/homebrew/opt/openjdk@23/bin:$PATH npm run emulators:e2e
```

ターミナル 2:

```sh
npm --prefix web install
npm --prefix web run dev:e2e
```

ターミナル 3:

```sh
npm run test:e2e:api
cd web
npx playwright install chromium
npm run test:e2e
```

iOS:

```sh
cd mobile
flutter pub get
flutter devices
sh integration_test/run-ios.sh <iOSシミュレーターID>
```

すべて `demo-aimasho-e2e` に固定。Auth9099 / Firestore8080 / Functions5001 / Next.js3007 を使います。既存の3000番サーバーは変更しません。地名検索だけは `USE_MOCK_MAPS=true` の固定データです。本番 Places/Maps 表示・実際の交通経路はこのテストに含めません。

テストごとに新しいローカルユーザーと予定を作ります。エミュレーター停止で破棄され、本番や既存データを一括削除しません。ブラウザの認証ストレージやトークンを成果物として保存しません。

Web レポートは `web/playwright-report/index.html`、Journey の画面証跡は `web/test-results/` に生成されます（Git 対象外）。

## iOS 固有の確認事項

- テストアカウントのログインと相手ユーザーの操作は Emulator SDK/HTTP によるセットアップ。Google ネイティブログイン画面は別途実機確認が必要です。
- 招待 URL はアプリのルーターへ渡して参加画面を操作します。メール等からの Universal Links ハンドオフは対象外です。
- 2026-09-09: iOS の「タイムライン追加/修正」に場所検索・選択・削除 UI を追加しました。再検証では東京駅・渋谷駅を iOS の画面で検索/選択し、プランの完了状態も画面操作で保存します。
- 再検証 PASS: ビルド22.8秒、テスト31秒。iOS UI による2地点の選択 → プラン完了 → 予定完了 → 友だちの完了回数1 → 2地点の Journey 再生/一時停止まで成功しました。
- iOS の FirebaseInstallations は Emulator でも API キーの書式を検証します。`demo-test-key` は起動直後に例外になるため、ランナーは正しい長さの **偽キー** を使用します。

## 本番の読み取り専用チェック（2026-09-09）

- セキュリティ更新後（Next.js15.5.25 / PostCSS8.5.28）、Web E2Eを再実行: デスクトップ26.6秒、モバイル幅10.8秒、2ケース成功（合計38.2秒）。Web33/Functions33/Flutter11の既存テスト、lint/typecheck/analyzeも成功。Web `npm audit --omit=dev` は既知の脆弱性0件。
- Cloud Functions は54件すべて ACTIVE。未デプロイだったソーシャル関数が含まれます。
- `aimasho.web.app` の `/`, `/login`, `/profile`, `/journey`: デスクトップ1440pxとモバイル390pxで HTTP 200、横スクロールなし、JS/CSS 取得失敗なし、ブラウザー例外なし。
- `/login` の Google ボタン表示を確認。
- 新しいソーシャル API は未認証リクエストへ正しく `401 UNAUTHENTICATED` を返します（以前の未デプロイ状態は解消）。認証付きデータ内容までの検証とは区別します。
- Firebase Auth: Google 提供元は有効、`aimasho.web.app` は認証許可ドメインに登録済み。
- Mac がロック中のため、本番の実 Google アカウントによる対話ログインは未検証。
- Firebase iOS アプリは未登録、`mobile/firebase.env.json` の運用値も未設定。実機 Google OAuth / OS の Universal Links は別途設定と確認が必要です。

再実行: `cd web` → `node e2e/production-smoke.mjs`。Google ログインや予定/友だちへの書き込み操作は行いません。ただし `/profile` の閲覧時にアプリ自身が Firebase Auth の匿名セッションを初期化する場合があります。画面証跡は `web/test-results/production/`、配布手順は [read.md](../read.md)。
