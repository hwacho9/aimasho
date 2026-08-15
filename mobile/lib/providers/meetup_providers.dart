import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/meetup.dart';
import '../repositories/meetup_repository.dart';

final meetupRepositoryProvider =
    Provider<MeetupRepository>((_) => MeetupRepository());
final currentUidProvider = StreamProvider<String?>(
    (_) => FirebaseAuth.instance.authStateChanges().map((user) => user?.uid));
final meetupProvider = StreamProvider.family<MeetupDetail, String>(
    (ref, meetupId) =>
        ref.watch(meetupRepositoryProvider).watchMeetup(meetupId));
final recommendationProvider = FutureProvider.family<Recommendation, String>(
    (ref, meetupId) =>
        ref.watch(meetupRepositoryProvider).recommendation(meetupId));
