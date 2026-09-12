// Runs the real iOS app against local Auth/Functions/Firestore emulators.
// Authentication and the remote peer are fixtures; the tested user's create,
// invite acceptance, planning, completion and Journey actions use the app UI.
import 'dart:convert';
import 'dart:io';

import 'package:aimasho/app/aimasho_app.dart';
import 'package:aimasho/features/meetup/meetup_screen.dart';
import 'package:aimasho/features/profile/profile_screen.dart';
import 'package:aimasho/features/social/social_home.dart';
import 'package:aimasho/providers/meetup_providers.dart';
import 'package:aimasho/repositories/meetup_repository.dart';
import 'package:aimasho/services/firebase_bootstrap.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('iOS: invitation -> plan -> completion -> friends -> Journey',
      (tester) async {
    expect(const bool.fromEnvironment('USE_FIREBASE_EMULATOR'), isTrue);
    expect(const String.fromEnvironment('FIREBASE_PROJECT_ID'),
        'demo-aimasho-e2e');
    await initializeDateFormatting('ko');
    await initializeDateFormatting('ja');
    await FirebaseBootstrap.initialize();
    await FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(false);
    final repository = MeetupRepository();
    final run = DateTime.now().millisecondsSinceEpoch;
    final auth = FirebaseAuth.instance;
    await auth.signOut();
    await auth.createUserWithEmailAndPassword(
        email: 'ios-$run@example.test', password: 'local-test-only-12345');
    await auth.currentUser!.updateDisplayName('iOS E2E');
    await repository.saveProfile('iOS E2E');
    final groupName = 'iOS home group $run';
    final peer = await _post(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-test-key',
        {
          'email': 'peer-$run@example.test',
          'password': 'local-test-only-12345',
          'returnSecureToken': true
        });
    final peerToken = peer['idToken'] as String;
    final peerUid = peer['localId'] as String;
    await _peer(peerToken, 'saveProfile', {'displayName': 'E2E Friend'});
    final invitation = await _peer(peerToken, 'createMeetup', {
      'title': 'Peer invitation $run',
      'displayName': 'E2E Friend',
      'durationMinutes': 120,
      'collectOrigins': false,
      'candidateSlots': ['2026-09-20T03:00:00Z'],
      'allowPlanEditing': true,
    });
    await tester.pumpWidget(ProviderScope(overrides: [
      firebaseReadyProvider.overrideWithValue(true),
      meetupRepositoryProvider.overrideWithValue(repository),
    ], child: const AimashoApp()));
    await _wait(tester, find.text('모임 만들기'));
    await _wait(tester, find.text('그룹 만들기·참여'));
    await _tapScrolled(tester, find.text('그룹 만들기·참여'));
    await _wait(tester, find.byType(ProfileScreen));
    await _wait(tester, find.text('MY AIMASHO'));
    await _tapScrolled(tester, _hint('새 Room 이름'));
    await tester.enterText(_hint('새 Room 이름'), groupName);
    await _tapScrolled(tester, find.text('+ 새 모임'));
    await _wait(tester, find.text('멤버 초대'));
    // Return through the retained navigation stack to check dashboard refresh.
    GoRouter.of(tester.element(find.text('멤버 초대'))).pop();
    await tester.pump(const Duration(milliseconds: 400));
    GoRouter.of(tester.element(_hint('새 Room 이름'))).pop();
    await _wait(tester, find.text(groupName));
    await _tapScrolled(tester, find.text(groupName));
    await _wait(tester, find.text('멤버 초대'));
    GoRouter.of(tester.element(find.text('멤버 초대'))).go('/');
    await _wait(tester, find.byType(SocialHome));
    debugPrint('E2E PASS: group created in UI, updated on home and opens its room');
    // Route injection represents opening an invitation URL; OS Universal Links
    // delivery itself is intentionally outside this integration test.
    GoRouter.of(tester.element(find.byType(SocialHome)))
        .go('/m/${invitation['meetupId']}');
    await _wait(tester, find.text('참여하기'));
    await tester.tap(find.text('참여하기'));
    await _wait(tester, find.byType(MeetupScreen));
    await _wait(tester, find.text('Peer invitation $run'));
    expect((await repository.socialOverview()).friends.single.uid, peerUid);
    debugPrint('E2E PASS: invitation accepted; reciprocal friend connection');

    GoRouter.of(tester.element(find.byType(MeetupScreen))).go('/new');
    await _wait(tester, _hint('예: 大学の友だちと夜ごはん'));
    await tester.enterText(_hint('예: 大学の友だちと夜ごはん'), 'iOS day $run');
    await _tapScrolled(tester, find.text('약속 만들기'));
    await _wait(tester, find.byType(MeetupScreen));
    final screen = tester.widget<MeetupScreen>(find.byType(MeetupScreen));
    final id = screen.meetupId;
    await _peer(
        peerToken, 'joinMeetup', {'meetupId': id, 'displayName': 'E2E Friend'});
    await _tapScrolled(tester, find.text('이 일정으로 결정'));
    await _waitUntil(
        tester,
        () async =>
            (await repository.watchMeetup(id).first).meetup.isConfirmed);
    debugPrint(
        'E2E PASS: create meetup with optional description and confirm date');

    for (final placeName in ['東京駅', '渋谷駅']) {
      await _tapScrolled(tester, find.text('할 일'));
      await _wait(tester, _hint('할 일 이름'));
      await tester.enterText(_hint('할 일 이름'), 'Visit $placeName');
      await tester.enterText(_hint('플랜 장소 검색 (선택)'), placeName);
      await _tapScrolled(
          tester,
          find.descendant(
              of: find.byType(AlertDialog), matching: find.text('검색')));
      final result = find.descendant(
          of: find.byType(ListTile), matching: find.text(placeName));
      await _wait(tester, result);
      await _tapScrolled(tester, result);
      await _wait(tester, find.byTooltip('선택한 장소 지우기'));
      await tester.tap(find.text('저장').last);
      await _wait(tester, find.text('Visit $placeName'));
      final row = find
          .ancestor(
              of: find.text('Visit $placeName'), matching: find.byType(Row))
          .first;
      await _tapScrolled(
          tester,
          find.descendant(
              of: row, matching: find.byType(PopupMenuButton<String>)));
      await _wait(tester, find.text('완료 표시'));
      await tester.tap(find.text('완료 표시'));
      await _waitUntil(
          tester,
          () async => (await repository.watchMeetup(id).first).planItems.any(
              (item) =>
                  item.title == 'Visit $placeName' &&
                  item.place?.name == placeName &&
                  item.status.name == 'completed'));
    }
    debugPrint(
        'E2E PASS: two places selected and plan items completed using iOS UI');
    await _tapScrolled(tester, find.text('약속 완료'));
    await _wait(tester, find.text('이 약속을 완료하고 기록으로 남길까요?'));
    await tester.tap(find.text('확인'));
    await _waitUntil(
        tester,
        () async =>
            (await repository.watchMeetup(id).first).meetup.status ==
            'COMPLETED');
    debugPrint('E2E PASS: plan form and host completion confirmation');

    GoRouter.of(tester.element(find.byType(MeetupScreen))).go('/');
    await _wait(tester, find.text('친구·그룹'));
    await tester.tap(find.text('친구·그룹'));
    await _wait(tester, find.text('E2E Friend'));
    await _tapScrolled(tester, find.text('둘의 기록 보기 →'));
    await _wait(tester, find.text('친구 기록'));
    await _wait(tester, find.text('둘만의 Journey'));
    final history = await repository.friendHistory(peerUid);
    expect(history.completedMeetupCount, 1);
    debugPrint('E2E PASS: friend visible, one completed shared meetup');

    GoRouter.of(tester.element(find.text('친구 기록'))).go('/journey');
    await _wait(tester, find.text('나의 Journey'));
    await _wait(tester, find.byTooltip('재생'));
    await tester.tap(find.byTooltip('재생'));
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.byTooltip('일시정지'), findsOneWidget);
    await tester.tap(find.byTooltip('일시정지'));
    expect((await repository.travelTimeline()).summary.totalStops, 2);
    expect(tester.takeException(), isNull);
    debugPrint(
        'E2E PASS: two-stop Journey rendered and playback started/paused');
  }, timeout: const Timeout(Duration(minutes: 8)));
}

Finder _hint(String hint) => find
    .byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == hint);

Future<void> _wait(WidgetTester tester, Finder finder) async {
  for (var i = 0; i < 180; i++) {
    await tester.pump(const Duration(milliseconds: 250));
    if (finder.evaluate().isNotEmpty) return;
  }
  expect(finder, findsWidgets, reason: 'UI did not appear in 45 seconds');
}

Future<void> _waitUntil(
    WidgetTester tester, Future<bool> Function() ready) async {
  for (var i = 0; i < 60; i++) {
    if (await ready()) return;
    await tester.pump(const Duration(milliseconds: 500));
  }
  fail('Saved state did not arrive');
}

Future<void> _tapScrolled(WidgetTester tester, Finder target) async {
  await tester.pump(const Duration(milliseconds: 500));
  if (target.evaluate().isEmpty) {
    await tester.scrollUntilVisible(target, 350,
        maxScrolls: 35, scrollable: find.byType(Scrollable).first);
  }
  await tester.ensureVisible(target.first);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(target.first);
  await tester.pump(const Duration(milliseconds: 300));
}

Future<Map<String, dynamic>> _post(String url, Map<String, dynamic> body,
    [String? token]) async {
  final uri = Uri.parse(url);
  if (uri.host != '127.0.0.1') {
    throw StateError('Only local emulator traffic is allowed');
  }
  final client = HttpClient();
  try {
    final request = await client.postUrl(uri);
    request.headers.contentType = ContentType.json;
    if (token != null) request.headers.set('Authorization', 'Bearer $token');
    request.write(jsonEncode(body));
    final response = await request.close();
    return jsonDecode(await utf8.decoder.bind(response).join())
        as Map<String, dynamic>;
  } finally {
    client.close();
  }
}

Future<Map<String, dynamic>> _peer(
    String token, String name, Map<String, dynamic> data) async {
  final result = await _post(
      'http://127.0.0.1:5001/demo-aimasho-e2e/asia-northeast1/$name',
      {'data': data},
      token);
  if (result['error'] != null) {
    throw StateError('$name failed: ${(result['error'] as Map)['status']}');
  }
  return Map<String, dynamic>.from(result['result'] as Map);
}
