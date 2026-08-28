import 'package:flutter/material.dart';
import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/configuration/configuration_required_screen.dart';
import '../features/friends/friend_history_screen.dart';
import '../features/home/home_screen.dart';
import '../features/meetup/create_meetup_screen.dart';
import '../features/meetup/meetup_screen.dart';
import '../features/meetup/join_meetup_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/rooms/room_screen.dart';
import '../features/rooms/join_room_screen.dart';
import '../services/firebase_bootstrap.dart';
import 'theme.dart';

class AimashoApp extends ConsumerWidget {
  const AimashoApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final firebaseReady = ref.watch(firebaseReadyProvider);
    return MaterialApp.router(
      title: 'aimasho',
      debugShowCheckedModeBanner: false,
      theme: aimashoTheme(),
      routerConfig: _router(firebaseReady),
    );
  }

  GoRouter _router(bool firebaseReady) => GoRouter(
        initialLocation: firebaseReady ? '/' : '/configuration',
        observers: firebaseReady
            ? [FirebaseAnalyticsObserver(analytics: FirebaseAnalytics.instance)]
            : const [],
        routes: [
          GoRoute(
              name: 'configuration',
              path: '/configuration',
              builder: (_, __) => const ConfigurationRequiredScreen()),
          GoRoute(
              name: 'home', path: '/', builder: (_, __) => const HomeScreen()),
          GoRoute(
              name: 'new_meetup',
              path: '/new',
              builder: (_, state) => CreateMeetupScreen(
                  roomId: state.uri.queryParameters['roomId'])),
          GoRoute(
              name: 'meetup_invite',
              path: '/m/:meetupId',
              builder: (_, state) => JoinMeetupScreen(
                  meetupId: state.pathParameters['meetupId']!)),
          GoRoute(
              name: 'meetup_plan',
              path: '/m/:meetupId/plan',
              builder: (_, state) =>
                  MeetupScreen(meetupId: state.pathParameters['meetupId']!)),
          GoRoute(
              name: 'profile',
              path: '/profile',
              builder: (_, __) => const ProfileScreen()),
          GoRoute(
              name: 'friend_history',
              path: '/friends/:otherUid',
              builder: (_, state) => FriendHistoryScreen(
                  otherUid: state.pathParameters['otherUid']!)),
          GoRoute(
              name: 'room',
              path: '/rooms/:roomId',
              builder: (_, state) =>
                  RoomScreen(roomId: state.pathParameters['roomId']!)),
          GoRoute(
              name: 'room_invite',
              path: '/r/:inviteCode',
              builder: (_, state) => JoinRoomScreen(
                  inviteCode: state.pathParameters['inviteCode']!)),
        ],
      );
}
