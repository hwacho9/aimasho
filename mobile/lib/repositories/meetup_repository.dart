// ignore_for_file: curly_braces_in_flow_control_structures

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/meetup.dart';
import '../services/firebase_bootstrap.dart';

class MeetupRepository {
  MeetupRepository(
      {FirebaseAuth? auth,
      FirebaseFirestore? firestore,
      FirebaseFunctions? functions})
      : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
        _functions = functions ??
            FirebaseFunctions.instanceFor(region: 'asia-northeast1') {
    if (FirebaseBootstrap.isConfigured &&
        const bool.fromEnvironment('USE_FIREBASE_EMULATOR')) {
      _firestore.useFirestoreEmulator('127.0.0.1', 8080);
      _functions.useFunctionsEmulator('127.0.0.1', 5001);
    }
  }

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  Future<User> ensureAnonymousUser() async =>
      _auth.currentUser ?? (await _auth.signInAnonymously()).user!;

  Future<void> identify(String displayName) async {
    final user = await ensureAnonymousUser();
    if (user.displayName != displayName) {
      await user.updateDisplayName(displayName);
    }
  }

  Future<User> continueWithGoogle() async {
    final googleUser = await GoogleSignIn().signIn();
    if (googleUser == null) throw StateError('Google sign-in was cancelled.');
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken, idToken: googleAuth.idToken);
    final currentUser = await ensureAnonymousUser();
    if (currentUser.isAnonymous)
      return (await currentUser.linkWithCredential(credential)).user!;
    return (await _auth.signInWithCredential(credential)).user!;
  }

  Future<void> saveProfile(String displayName) async {
    await _functions
        .httpsCallable('saveProfile')
        .call({'displayName': displayName});
  }

  Future<String> createMeetup(
      {required String hostName,
      required String title,
      String? description,
      required int durationMinutes,
      required List<DateTime> candidateSlots,
      String? roomId}) async {
    await identify(hostName);
    final callable = _functions.httpsCallable('createMeetup');
    final result = await callable.call({
      'title': title,
      'displayName': hostName,
      if (description != null && description.isNotEmpty)
        'description': description,
      'durationMinutes': durationMinutes,
      'candidateSlots':
          candidateSlots.map((slot) => slot.toUtc().toIso8601String()).toList(),
      if (roomId != null) 'roomId': roomId,
    });
    return Map<String, dynamic>.from(result.data as Map)['meetupId'] as String;
  }

  Future<InvitePreview> getInvitePreview(String meetupId) async {
    await ensureAnonymousUser();
    final result = await _functions
        .httpsCallable('getMeetupInvitePreview')
        .call({'meetupId': meetupId});
    final data = Map<String, dynamic>.from(result.data as Map);
    return InvitePreview(
        meetupId: data['meetupId'] as String,
        title: data['title'] as String,
        hostName: data['hostName'] as String,
        isAlreadyParticipant: data['isAlreadyParticipant'] as bool);
  }

  Future<void> joinMeetup(String meetupId, String displayName) async {
    await identify(displayName);
    await _functions
        .httpsCallable('joinMeetup')
        .call({'meetupId': meetupId, 'displayName': displayName});
  }

  Future<void> submitVote(
      String meetupId, String slotId, VoteStatus status) async {
    await ensureAnonymousUser();
    await _functions
        .httpsCallable('upsertVote')
        .call({'meetupId': meetupId, 'slotId': slotId, 'status': status.value});
  }

  Future<Recommendation> recommendation(String meetupId) async {
    await ensureAnonymousUser();
    final result = await _functions
        .httpsCallable('calculateScheduleRecommendation')
        .call({'meetupId': meetupId});
    final data = Map<String, dynamic>.from(result.data as Map);
    final ranking = (data['ranking'] as List<dynamic>)
        .map((item) => _recommendation(Map<String, dynamic>.from(item as Map)))
        .toList();
    return Recommendation(
        recommended: data['recommended'] == null
            ? null
            : _recommendation(
                Map<String, dynamic>.from(data['recommended'] as Map)),
        ranking: ranking);
  }

  Future<void> confirmSchedule(String meetupId, String slotId) => _functions
      .httpsCallable('confirmSchedule')
      .call({'meetupId': meetupId, 'slotId': slotId});

  Future<List<Location>> searchPlaces(String query) async {
    final result =
        await _functions.httpsCallable('searchPlaces').call({'query': query});
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['places'] as List<dynamic>)
        .map((item) => _location(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<void> saveOrigin(String meetupId, Location origin) => _functions
      .httpsCallable('saveOrigin')
      .call({'meetupId': meetupId, 'origin': _locationMap(origin)});
  Future<void> beginLocationSelection(String meetupId) => _functions
      .httpsCallable('beginLocationSelection')
      .call({'meetupId': meetupId});
  Future<List<MeetingPointCandidate>> meetingPointRecommendations(
      String meetupId, String mode) async {
    final result = await _functions
        .httpsCallable('getMeetingPointRecommendations')
        .call({'meetupId': meetupId, 'mode': mode});
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['candidates'] as List<dynamic>)
        .map((item) => _meetingPoint(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<void> confirmMeetingPlace(String meetupId, Location place) =>
      _functions
          .httpsCallable('confirmMeetingPlace')
          .call({'meetupId': meetupId, 'meetingPlace': _locationMap(place)});
  Future<void> calculateRoutes(String meetupId) =>
      _functions.httpsCallable('calculateRoutes').call({'meetupId': meetupId});
  Future<void> registerDepartureNotifications(String meetupId) async {
    final settings = await FirebaseMessaging.instance
        .requestPermission(alert: true, badge: true, sound: true);
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;
    final token = await FirebaseMessaging.instance.getToken();
    if (token == null) return;
    await _functions
        .httpsCallable('registerDeviceToken')
        .call({'meetupId': meetupId, 'token': token});
  }

  Future<void> createExpense(String meetupId,
          {required String title,
          required int amount,
          required String paidByUid,
          required List<String> participantUids}) =>
      _functions.httpsCallable('createExpense').call({
        'meetupId': meetupId,
        'title': title,
        'amount': amount,
        'paidByUid': paidByUid,
        'participantUids': participantUids
      });
  Future<Settlement> settlement(String meetupId) async {
    final result = await _functions
        .httpsCallable('calculateSettlementResult')
        .call({'meetupId': meetupId});
    final data = Map<String, dynamic>.from(result.data as Map);
    return Settlement(
        totalAmount: data['totalAmount'] as int,
        balances: (data['balances'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return Balance(
              participantUid: value['participantUid'] as String,
              amount: value['amount'] as int);
        }).toList(),
        transfers: (data['transfers'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return Transfer(
              fromUid: value['fromUid'] as String,
              toUid: value['toUid'] as String,
              amount: value['amount'] as int);
        }).toList());
  }

  Future<void> saveDefaultOrigin(Location location) => _functions
      .httpsCallable('saveDefaultOrigin')
      .call({'defaultOrigin': _locationMap(location)});
  Future<Room> createRoom(String name, String displayName) async {
    final result = await _functions
        .httpsCallable('createRoom')
        .call({'name': name, 'displayName': displayName});
    final data = Map<String, dynamic>.from(result.data as Map);
    return Room(
        id: data['roomId'] as String,
        name: name,
        inviteCode: data['inviteCode'] as String,
        role: 'OWNER');
  }

  Future<List<Room>> myRooms() async {
    final result = await _functions.httpsCallable('getMyRooms').call();
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['rooms'] as List<dynamic>).map((item) {
      final value = Map<String, dynamic>.from(item as Map);
      return Room(
          id: value['id'] as String,
          name: value['name'] as String,
          inviteCode: value['inviteCode'] as String,
          role: value['role'] as String);
    }).toList();
  }

  Future<String> joinRoom(String inviteCode, String displayName) async {
    final result = await _functions
        .httpsCallable('joinRoom')
        .call({'inviteCode': inviteCode, 'displayName': displayName});
    return Map<String, dynamic>.from(result.data as Map)['roomId'] as String;
  }

  Future<Map<String, String>> roomInvitePreview(String inviteCode) async {
    final result = await _functions
        .httpsCallable('getRoomInvitePreview')
        .call({'inviteCode': inviteCode});
    final data = Map<String, dynamic>.from(result.data as Map);
    return {
      'roomId': data['roomId'] as String,
      'name': data['name'] as String,
      'ownerName': data['ownerName'] as String,
    };
  }

  Future<RoomDetail> roomDetail(String roomId) async {
    final result = await _functions
        .httpsCallable('getRoomDetail')
        .call({'roomId': roomId});
    final data = Map<String, dynamic>.from(result.data as Map);
    final room = Map<String, dynamic>.from(data['room'] as Map);
    return RoomDetail(
        room: Room(
            id: room['id'] as String,
            name: room['name'] as String,
            inviteCode: room['inviteCode'] as String,
            role: room['ownerUid'] == _auth.currentUser?.uid
                ? 'OWNER'
                : 'MEMBER'),
        members: (data['members'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return RoomMember(
              uid: value['uid'] as String,
              displayName: value['displayName'] as String,
              role: value['role'] as String);
        }).toList(),
        meetups: (data['meetups'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return RoomMeetup(
              id: value['id'] as String,
              title: value['title'] as String,
              status: value['status'] as String,
              confirmedDateTime: value['confirmedDateTime'] == null
                  ? null
                  : DateTime.parse(value['confirmedDateTime'] as String)
                      .toLocal());
        }).toList());
  }

  Stream<MeetupDetail> watchMeetup(String meetupId) {
    final base = _firestore.collection('meetups').doc(meetupId);
    return _combine6(
        base.snapshots(),
        base.collection('participants').snapshots(),
        base.collection('candidateSlots').orderBy('startDateTime').snapshots(),
        base.collection('votes').snapshots(),
        base.collection('routes').snapshots(),
        base.collection('expenses').snapshots(), (meetupSnapshot,
            participantsSnapshot,
            slotsSnapshot,
            votesSnapshot,
            routesSnapshot,
            expensesSnapshot) {
      if (!meetupSnapshot.exists) throw StateError('약속을 찾을 수 없어요.');
      final data = meetupSnapshot.data()!;
      return MeetupDetail(
        meetup: Meetup(
            id: meetupSnapshot.id,
            title: data['title'] as String,
            description: data['description'] as String?,
            createdByUid: data['createdByUid'] as String,
            status: data['status'] as String,
            durationMinutes: data['durationMinutes'] as int,
            confirmedDateTime: _date(data['confirmedDateTime']),
            meetingPlace: data['meetingPlace'] == null
                ? null
                : _location(
                    Map<String, dynamic>.from(data['meetingPlace'] as Map)),
            targetArrivalTime: _date(data['targetArrivalTime'])),
        participants: participantsSnapshot.docs.map((doc) {
          final item = doc.data();
          return Participant(
              uid: item['uid'] as String,
              displayName: item['displayName'] as String,
              isGuest: item['isGuest'] as bool,
              isHost: item['isHost'] as bool,
              hasOrigin: item['hasOrigin'] as bool? ?? false,
              originArea: item['originArea'] as String?);
        }).toList(),
        candidateSlots: slotsSnapshot.docs.map((doc) {
          final item = doc.data();
          return CandidateSlot(
              id: doc.id, startDateTime: _date(item['startDateTime'])!);
        }).toList(),
        votes: votesSnapshot.docs.map((doc) {
          final item = doc.data();
          return AvailabilityVote(
              participantUid: item['participantUid'] as String,
              slotId: item['slotId'] as String,
              status: VoteStatusValue.fromValue(item['status'] as String));
        }).toList(),
        routes: routesSnapshot.docs.map((doc) {
          final item = doc.data();
          return ParticipantRoute(
              participantUid: item['participantUid'] as String,
              durationMinutes: item['durationMinutes'] as int,
              transfers: item['transfers'] as int? ?? 0,
              routeSummary: item['routeSummary'] as String,
              externalMapsUrl: item['externalMapsUrl'] as String,
              departureTime: _date(item['departureTime'])!,
              arrivalTime: _date(item['arrivalTime'])!);
        }).toList(),
        expenses: expensesSnapshot.docs.map((doc) {
          final item = doc.data();
          return Expense(
              id: doc.id,
              title: item['title'] as String,
              amount: item['amount'] as int,
              paidByUid: item['paidByUid'] as String,
              participantUids:
                  List<String>.from(item['participantUids'] as List),
              createdByUid: item['createdByUid'] as String);
        }).toList(),
      );
    });
  }

  RecommendationSlot _recommendation(Map<String, dynamic> data) =>
      RecommendationSlot(
          id: data['id'] as String,
          startDateTime:
              DateTime.parse(data['startDateTime'] as String).toLocal(),
          yes: data['yes'] as int,
          maybe: data['maybe'] as int,
          no: data['no'] as int,
          totalScore: data['totalScore'] as int,
          participantCount: data['participantCount'] as int);
  Location _location(Map<String, dynamic> data) => Location(
      placeId: data['placeId'] as String,
      name: data['name'] as String,
      address: data['address'] as String?,
      latitude: (data['latitude'] as num).toDouble(),
      longitude: (data['longitude'] as num).toDouble());
  Map<String, dynamic> _locationMap(Location location) => {
        'placeId': location.placeId,
        'name': location.name,
        if (location.address != null) 'address': location.address,
        'latitude': location.latitude,
        'longitude': location.longitude
      };
  MeetingPointCandidate _meetingPoint(Map<String, dynamic> data) =>
      MeetingPointCandidate(
          placeId: data['placeId'] as String,
          name: data['name'] as String,
          address: data['address'] as String?,
          latitude: (data['latitude'] as num).toDouble(),
          longitude: (data['longitude'] as num).toDouble(),
          averageDurationMinutes:
              (data['averageDurationMinutes'] as num).toDouble(),
          maxDurationMinutes: data['maxDurationMinutes'] as int,
          standardDeviationMinutes:
              (data['standardDeviationMinutes'] as num).toDouble(),
          fairScore: (data['fairScore'] as num).toDouble(),
          fastScore: (data['fastScore'] as num).toDouble(),
          score: (data['score'] as num).toDouble(),
          participantDurations:
              (data['participantDurations'] as List<dynamic>).map((item) {
            final value = Map<String, dynamic>.from(item as Map);
            return ParticipantDuration(
                participantUid: value['participantUid'] as String,
                durationMinutes: value['durationMinutes'] as int);
          }).toList());
  DateTime? _date(dynamic value) => value is Timestamp
      ? value.toDate()
      : value == null
          ? null
          : DateTime.parse(value as String);
}

/// Emits a combined value whenever any of four Firestore collections changes.
Stream<R> _combine6<A, B, C, D, E, F, R>(
    Stream<A> first,
    Stream<B> second,
    Stream<C> third,
    Stream<D> fourth,
    Stream<E> fifth,
    Stream<F> sixth,
    R Function(A, B, C, D, E, F) build) {
  late StreamController<R> controller;
  A? a;
  B? b;
  C? c;
  D? d;
  E? e;
  F? f;
  void emit() {
    if (a != null &&
        b != null &&
        c != null &&
        d != null &&
        e != null &&
        f != null) {
      controller.add(build(a as A, b as B, c as C, d as D, e as E, f as F));
    }
  }

  controller = StreamController<R>(onListen: () {
    final subscriptions = [
      first.listen((value) {
        a = value;
        emit();
      }, onError: controller.addError),
      second.listen((value) {
        b = value;
        emit();
      }, onError: controller.addError),
      third.listen((value) {
        c = value;
        emit();
      }, onError: controller.addError),
      fourth.listen((value) {
        d = value;
        emit();
      }, onError: controller.addError),
      fifth.listen((value) {
        e = value;
        emit();
      }, onError: controller.addError),
      sixth.listen((value) {
        f = value;
        emit();
      }, onError: controller.addError)
    ];
    controller.onCancel = () =>
        Future.wait(subscriptions.map((subscription) => subscription.cancel()));
  });
  return controller.stream;
}
