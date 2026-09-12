import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:aimasho/models/meetup.dart';
import 'package:aimasho/models/social.dart';
import 'package:aimasho/features/social/social_home.dart';

void main() {
  testWidgets('home groups show roles and open the selected group',
      (tester) async {
    final router = GoRouter(routes: [
      GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(
                  body: HomeGroupsPanel(rooms: [
                DashboardRoom(
                    id: 'owned',
                    name: 'PD4',
                    inviteCode: '',
                    role: 'OWNER',
                    completedMeetupCount: 0),
                DashboardRoom(
                    id: 'joined',
                    name: '함께 노는 친구들',
                    inviteCode: '',
                    role: 'MEMBER',
                    completedMeetupCount: 0),
              ]))),
      GoRoute(
          path: '/rooms/:id',
          builder: (_, state) =>
              Scaffold(body: Text('group ${state.pathParameters['id']}'))),
    ]);
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    expect(find.text('내 그룹 · 2'), findsOneWidget);
    expect(find.text('관리자'), findsOneWidget);
    expect(find.text('멤버'), findsOneWidget);
    await tester.tap(find.text('함께 노는 친구들'));
    await tester.pumpAndSettle();
    expect(find.text('group joined'), findsOneWidget);
  });

  testWidgets('empty home groups offer creation and joining', (tester) async {
    final router = GoRouter(routes: [
      GoRoute(
          path: '/',
          builder: (_, __) => const Scaffold(body: HomeGroupsPanel(rooms: []))),
      GoRoute(
          path: '/profile',
          builder: (_, __) => const Scaffold(body: Text('Group management'))),
    ]);
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    expect(find.textContaining('아직 그룹이 없어요'), findsOneWidget);
    await tester.tap(find.text('그룹 만들기·참여'));
    await tester.pumpAndSettle();
    expect(find.text('Group management'), findsOneWidget);
  });

  testWidgets('home groups fit narrow screens with long names and large text',
      (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
            body: MediaQuery(
      data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
      child: SingleChildScrollView(
          child: HomeGroupsPanel(rooms: [
        DashboardRoom(
            id: 'group',
            name: '함께 여행하는 아주 긴 이름의 친구들 모임',
            inviteCode: '',
            role: 'MEMBER',
            completedMeetupCount: 0),
      ])),
    ))));
    expect(find.text('함께 여행하는 아주 긴 이름의 친구들 모임'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test(
      'social mapping preserves completed vs planned counts and privacy projection',
      () {
    final overview = SocialOverview.fromMap({
      'limited': true,
      'friends': [
        {
          'uid': 'friend',
          'displayName': '하나',
          'completedCount': 2,
          'plannedCount': 1,
          'milestone': {'level': 1, 'next': 3, 'progress': 0.5},
          'lastMetAt': null
        }
      ],
      'memories': [
        {
          'id': 'memory',
          'title': '저녁',
          'date': null,
          'placeName': null,
          'companions': [
            {'uid': 'friend', 'displayName': '하나'}
          ]
        }
      ],
    });
    expect(overview.friends.single.completedCount, 2);
    expect(overview.friends.single.plannedCount, 1);
    expect(overview.friends.single.progress, 0.5);
    expect(overview.memories.single.companions, ['하나']);
    expect(overview.limited, isTrue);
  });

  testWidgets('friend card stays readable on a narrow screen with large text',
      (tester) async {
    tester.view.resetPhysicalSize();
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(
        home: Scaffold(
            body: MediaQuery(
      data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
      child: SingleChildScrollView(
          child: SocialFriendCard(
              friend: SocialFriend(
                  uid: 'friend',
                  displayName: '아주 긴 이름의 친구 하나',
                  completedCount: 2,
                  plannedCount: 1,
                  level: 1,
                  progress: 0.5,
                  next: 3))),
    ))));
    expect(find.text('2번의 만남 기록'), findsOneWidget);
    expect(find.text('진행 중 약속 1개'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
