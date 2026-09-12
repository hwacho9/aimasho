import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/meetup.dart';
import '../models/social.dart';
import '../repositories/meetup_repository.dart';

final meetupRepositoryProvider =
    Provider<MeetupRepository>((_) => MeetupRepository());
final currentUidProvider = StreamProvider<String?>(
    (_) => FirebaseAuth.instance.authStateChanges().map((user) => user?.uid));
final authUserProvider =
    StreamProvider<User?>((_) => FirebaseAuth.instance.authStateChanges());
final dashboardProvider = FutureProvider.autoDispose<HomeDashboard>((ref) {
  ref.watch(authUserProvider.select((auth) => auth.valueOrNull?.uid));
  return ref.watch(meetupRepositoryProvider).myDashboard();
});
final socialOverviewProvider =
    FutureProvider.autoDispose<SocialOverview>((ref) {
  ref.watch(authUserProvider.select((auth) => auth.valueOrNull?.uid));
  return ref.watch(meetupRepositoryProvider).socialOverview();
});
final guestMeetupsProvider =
    FutureProvider.autoDispose<List<DashboardMeetup>>((ref) {
  ref.watch(authUserProvider.select((auth) => auth.valueOrNull?.uid));
  return ref.watch(meetupRepositoryProvider).guestMeetups();
});
final travelTimelineProvider = FutureProvider.autoDispose<TravelTimeline>(
    (ref) => ref.watch(meetupRepositoryProvider).travelTimeline());
final meetupProvider = StreamProvider.family<MeetupDetail, String>(
    (ref, meetupId) =>
        ref.watch(meetupRepositoryProvider).watchMeetup(meetupId));
final recommendationProvider = FutureProvider.family<Recommendation, String>(
    (ref, meetupId) =>
        ref.watch(meetupRepositoryProvider).recommendation(meetupId));
final meetupRelationshipsProvider =
    FutureProvider.family<List<RelationshipStat>, String>((ref, meetupId) =>
        ref.watch(meetupRepositoryProvider).meetupRelationships(meetupId));
