# aimasho Flutter

웹과 같은 Firebase 프로젝트를 사용하는 iOS, Android, macOS Flutter 앱입니다.

## 로컬 실행

1. `firebase.env.example.json`을 `firebase.env.json`으로 복사합니다.
2. Firebase Console의 웹/모바일 앱 설정값을 `firebase.env.json`에 입력합니다.
3. Google 로그인을 사용할 때 `GOOGLE_CLIENT_ID`(Apple OAuth 클라이언트)와 필요하면 `GOOGLE_SERVER_CLIENT_ID`를 입력합니다.
4. 패키지를 받고 앱을 실행합니다.

```bash
flutter pub get
flutter run --dart-define-from-file=firebase.env.json
```

`firebase.env.json`은 Git에 포함되지 않습니다. 현재 파일의 Firebase 핵심 값이 비어 있으면 앱은 설정 안내 화면만 표시합니다.

## Apple Google 로그인

iOS/macOS 앱을 Firebase와 Google Cloud에 각각 등록하고, `GoogleService-Info.plist`의 `REVERSED_CLIENT_ID`를 Runner의 `Info.plist > CFBundleURLTypes`에 URL scheme으로 추가해야 합니다. macOS 네트워크 권한은 프로젝트에 포함되어 있습니다. macOS Google 로그인을 배포할 때는 Apple 개발팀 서명을 설정한 뒤 `keychain-access-groups`에 `$(AppIdentifierPrefix)com.google.GIDSignIn`도 추가하세요. 서명 인증서가 없는 기본 디버그 빌드에서는 이 entitlement를 넣으면 Xcode 빌드가 실패합니다.

## 검증

```bash
flutter analyze
flutter test
flutter build macos --debug --dart-define-from-file=firebase.env.json
flutter build apk --debug --dart-define-from-file=firebase.env.json
```

Android 빌드에는 Android SDK와 `ANDROID_HOME` 설정이 필요합니다.
