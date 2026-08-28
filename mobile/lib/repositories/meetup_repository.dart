// ignore_for_file: curly_braces_in_flow_control_structures

import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../models/meetup.dart';
import '../services/analytics.dart';
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
    final googleUser = await GoogleSignIn(
            clientId: FirebaseBootstrap.googleClientId,
            serverClientId: FirebaseBootstrap.googleServerClientId)
        .signIn();
    if (googleUser == null) throw StateError('Google sign-in was cancelled.');
    final googleAuth = await googleUser.authentication;
    final credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken, idToken: googleAuth.idToken);
    final currentUser = await ensureAnonymousUser();
    if (currentUser.isAnonymous) {
      try {
        return (await currentUser.linkWithCredential(credential)).user!;
      } on FirebaseAuthException catch (error) {
        if (error.code != 'credential-already-in-use' &&
            error.code != 'email-already-in-use') rethrow;
        return (await _auth.signInWithCredential(credential)).user!;
      }
    }
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
      String? roomId,
      bool collectOrigins = true,
      bool allowParticipantSlotAdd = false,
      DateTime? responseDeadline,
      bool foodVoting = false,
      bool activityVoting = false,
      bool allowMultipleContentVotes = false,
      bool allowParticipantContentOptions = true,
      bool allowPlanEditing = false}) async {
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
      'collectOrigins': collectOrigins,
      'allowParticipantSlotAdd': allowParticipantSlotAdd,
      if (responseDeadline != null)
        'responseDeadline': responseDeadline.toUtc().toIso8601String(),
      'contentVoteConfig': {
        'food': foodVoting,
        'activity': activityVoting,
        'allowMultiple': allowMultipleContentVotes,
        'allowParticipantOptions': allowParticipantContentOptions,
      },
      'allowPlanEditing': allowPlanEditing,
    });
    final meetupId =
        Map<String, dynamic>.from(result.data as Map)['meetupId'] as String;
    AppAnalytics.log('meetup_created');
    return meetupId;
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
    AppAnalytics.log('meetup_joined');
  }

  Future<void> submitVote(
      String meetupId, String slotId, VoteStatus status) async {
    await ensureAnonymousUser();
    await _functions
        .httpsCallable('upsertVote')
        .call({'meetupId': meetupId, 'slotId': slotId, 'status': status.value});
  }

  Future<void> addCandidateSlot(String meetupId, DateTime startDateTime) async {
    await _functions.httpsCallable('addCandidateSlot').call({
      'meetupId': meetupId,
      'startDateTime': startDateTime.toUtc().toIso8601String(),
    });
  }

  Future<void> toggleContentVote(
      String meetupId, String optionId, bool selected) async {
    await _functions.httpsCallable('toggleContentVote').call({
      'meetupId': meetupId,
      'optionId': optionId,
      'selected': selected,
    });
  }

  Future<void> addContentOption(
      String meetupId, ContentCategory category, String label) async {
    await _functions.httpsCallable('addContentOption').call({
      'meetupId': meetupId,
      'category': category.value,
      'label': label,
    });
  }

  Map<String, dynamic> _planItemPayload(
          {required PlanItemType type,
          required String title,
          DateTime? scheduledAt,
          Location? place,
          String? note}) =>
      {
        'type': type.value,
        'title': title,
        if (scheduledAt != null)
          'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        if (place != null) 'place': _locationMap(place),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        'source': 'manual',
      };

  Future<void> createPlanItem(String meetupId,
      {required PlanItemType type,
      required String title,
      DateTime? scheduledAt,
      Location? place,
      String? note}) async {
    await _functions.httpsCallable('createPlanItem').call({
      'meetupId': meetupId,
      'item': _planItemPayload(
          type: type,
          title: title,
          scheduledAt: scheduledAt,
          place: place,
          note: note),
    });
  }

  Future<void> updatePlanItem(String meetupId, String itemId,
      {required PlanItemType type,
      required String title,
      DateTime? scheduledAt,
      Location? place,
      String? note}) async {
    await _functions.httpsCallable('updatePlanItem').call({
      'meetupId': meetupId,
      'itemId': itemId,
      'item': _planItemPayload(
          type: type,
          title: title,
          scheduledAt: scheduledAt,
          place: place,
          note: note),
    });
  }

  Future<void> deletePlanItem(String meetupId, String itemId) => _functions
      .httpsCallable('deletePlanItem')
      .call({'meetupId': meetupId, 'itemId': itemId});

  Future<void> reorderPlanItems(String meetupId, List<String> itemIds) =>
      _functions
          .httpsCallable('reorderPlanItems')
          .call({'meetupId': meetupId, 'itemIds': itemIds});

  Future<void> setPlanItemStatus(
          String meetupId, String itemId, PlanItemStatus status) =>
      _functions.httpsCallable('setPlanItemStatus').call({
        'meetupId': meetupId,
        'itemId': itemId,
        'status': status.name,
      });

  Future<void> completeMeetup(String meetupId) =>
      _functions.httpsCallable('completeMeetup').call({'meetupId': meetupId});

  Future<void> cancelMeetup(String meetupId) =>
      _functions.httpsCallable('cancelMeetup').call({'meetupId': meetupId});

  Future<void> deleteMeetup(String meetupId) =>
      _functions.httpsCallable('deleteMeetup').call({'meetupId': meetupId});

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

  Future<List<RelationshipStat>> meetupRelationships(String meetupId) async {
    final result = await _functions
        .httpsCallable('getMeetupRelationships')
        .call({'meetupId': meetupId});
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['relationships'] as List<dynamic>)
        .map((item) => _relationship(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<List<RelationshipStat>> myRelationships() async {
    final result = await _functions.httpsCallable('getMyRelationships').call();
    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['relationships'] as List<dynamic>)
        .map((item) => _relationship(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<FriendHistory> friendHistory(String otherUid) async {
    final result = await _functions
        .httpsCallable('getFriendHistory')
        .call({'otherUid': otherUid});
    final data = Map<String, dynamic>.from(result.data as Map);
    return FriendHistory(
        otherUid: data['otherUid'] as String,
        displayName: data['displayName'] as String,
        completedMeetupCount: (data['completedMeetupCount'] as num).toInt(),
        meetups: (data['meetups'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return DashboardMeetup(
              id: value['id'] as String,
              title: value['title'] as String,
              status: value['status'] as String,
              candidateDateTimes:
                  (value['candidateDateTimes'] as List<dynamic>? ?? const [])
                      .map((date) => DateTime.parse(date as String).toLocal())
                      .toList(),
              isOwner: false,
              confirmedDateTime: _isoDate(value['confirmedDateTime']),
              completedAt: _isoDate(value['completedAt']),
              meetingPlace: value['meetingPlace'] == null
                  ? null
                  : _location(
                      Map<String, dynamic>.from(value['meetingPlace'] as Map)),
              roomId: value['roomId'] as String?);
        }).toList());
  }

  Future<void> confirmSchedule(String meetupId, String slotId) async {
    await _functions
        .httpsCallable('confirmSchedule')
        .call({'meetupId': meetupId, 'slotId': slotId});
    AppAnalytics.log('schedule_confirmed');
  }

  Future<void> updateConfirmedSchedule(
      String meetupId, DateTime confirmedDateTime) async {
    await _functions.httpsCallable('updateConfirmedSchedule').call({
      'meetupId': meetupId,
      'confirmedDateTime': confirmedDateTime.toUtc().toIso8601String(),
    });
    AppAnalytics.log('schedule_updated');
  }

  Future<void> updateConfirmedScheduleAvailability(
      String meetupId, VoteStatus status) async {
    await _functions.httpsCallable('updateConfirmedScheduleAvailability').call({
      'meetupId': meetupId,
      'status': status.value,
    });
    AppAnalytics.log('confirmed_schedule_availability_updated');
  }

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

  Future<void> confirmMeetingPlace(String meetupId, Location place) async {
    await _functions
        .httpsCallable('confirmMeetingPlace')
        .call({'meetupId': meetupId, 'meetingPlace': _locationMap(place)});
    AppAnalytics.log('meeting_place_confirmed');
  }

  Future<void> calculateRoutes(String meetupId) async {
    await _functions
        .httpsCallable('calculateRoutes')
        .call({'meetupId': meetupId});
    AppAnalytics.log('routes_calculated');
  }

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
      required List<String> participantUids}) async {
    await _functions.httpsCallable('createExpense').call({
      'meetupId': meetupId,
      'title': title,
      'amount': amount,
      'paidByUid': paidByUid,
      'participantUids': participantUids
    });
    AppAnalytics.log('expense_created');
  }

  Future<void> updateExpense(String meetupId, String expenseId,
      {required String title,
      required int amount,
      required String paidByUid,
      required List<String> participantUids}) async {
    await _functions.httpsCallable('updateExpense').call({
      'meetupId': meetupId,
      'expenseId': expenseId,
      'title': title,
      'amount': amount,
      'paidByUid': paidByUid,
      'participantUids': participantUids
    });
    AppAnalytics.log('expense_updated');
  }

  Future<void> deleteExpense(String meetupId, String expenseId) async {
    await _functions
        .httpsCallable('deleteExpense')
        .call({'meetupId': meetupId, 'expenseId': expenseId});
    AppAnalytics.log('expense_deleted');
  }

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
    AppAnalytics.log('room_created');
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
    final roomId =
        Map<String, dynamic>.from(result.data as Map)['roomId'] as String;
    AppAnalytics.log('room_joined');
    return roomId;
  }

  Future<Map<String, String>> roomInvitePreview(String inviteCode) async {
    await ensureAnonymousUser();
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
    final ownerUid = room['ownerUid'] as String;
    final summary = data['summary'] == null
        ? <String, dynamic>{}
        : Map<String, dynamic>.from(data['summary'] as Map);
    return RoomDetail(
        room: Room(
            id: room['id'] as String,
            name: room['name'] as String,
            inviteCode: room['inviteCode'] as String,
            role: ownerUid == _auth.currentUser?.uid ? 'OWNER' : 'MEMBER'),
        ownerUid: ownerUid,
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
                      .toLocal(),
              completedAt: value['completedAt'] == null
                  ? null
                  : DateTime.parse(value['completedAt'] as String).toLocal(),
              meetingPlace: value['meetingPlace'] == null
                  ? null
                  : _location(
                      Map<String, dynamic>.from(value['meetingPlace'] as Map)),
              occurrence: (value['occurrence'] as num?)?.toInt());
        }).toList(),
        summary: RoomSummary(
            completedMeetupCount:
                (summary['completedMeetupCount'] as num?)?.toInt() ?? 0,
            uniquePlaceCount:
                (summary['uniquePlaceCount'] as num?)?.toInt() ?? 0,
            mostVisitedPlace: summary['mostVisitedPlace'] == null
                ? null
                : _placeVisit(Map<String, dynamic>.from(
                    summary['mostVisitedPlace'] as Map))),
        mapPlaces: (data['mapPlaces'] as List<dynamic>? ?? const [])
            .map((item) => _placeVisit(Map<String, dynamic>.from(item as Map)))
            .toList());
  }

  Future<void> deleteRoom(String roomId) =>
      _functions.httpsCallable('deleteRoom').call({'roomId': roomId});

  Future<HomeDashboard> myDashboard() async {
    final result = await _functions.httpsCallable('getMyDashboard').call();
    final data = Map<String, dynamic>.from(result.data as Map);
    final summary = Map<String, dynamic>.from(data['summary'] as Map);
    return HomeDashboard(
        displayName: data['displayName'] as String,
        meetups: (data['meetups'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return DashboardMeetup(
              id: value['id'] as String,
              title: value['title'] as String,
              status: value['status'] as String,
              candidateDateTimes:
                  (value['candidateDateTimes'] as List<dynamic>? ?? const [])
                      .map((date) => DateTime.parse(date as String).toLocal())
                      .toList(),
              isOwner: value['isOwner'] as bool? ?? false,
              confirmedDateTime: _isoDate(value['confirmedDateTime']),
              completedAt: _isoDate(value['completedAt']),
              meetingPlace: value['meetingPlace'] == null
                  ? null
                  : _location(
                      Map<String, dynamic>.from(value['meetingPlace'] as Map)),
              roomId: value['roomId'] as String?,
              roomName: value['roomName'] as String?);
        }).toList(),
        relationships: (data['relationships'] as List<dynamic>)
            .map(
                (item) => _relationship(Map<String, dynamic>.from(item as Map)))
            .toList(),
        rooms: (data['rooms'] as List<dynamic>).map((item) {
          final value = Map<String, dynamic>.from(item as Map);
          return DashboardRoom(
              id: value['id'] as String,
              name: value['name'] as String,
              inviteCode: value['inviteCode'] as String,
              role: value['role'] as String,
              completedMeetupCount:
                  (value['completedMeetupCount'] as num).toInt(),
              nextMeetupDate: _isoDate(value['nextMeetupDate']));
        }).toList(),
        summary: DashboardSummary(
            upcomingMeetupCount:
                (summary['upcomingMeetupCount'] as num).toInt(),
            completedMeetupCount:
                (summary['completedMeetupCount'] as num).toInt(),
            friendCount: (summary['friendCount'] as num).toInt(),
            groupCount: (summary['groupCount'] as num).toInt()));
  }

  Stream<MeetupDetail> watchMeetup(String meetupId) {
    final base = _firestore.collection('meetups').doc(meetupId);
    return _combine9(
        base.snapshots(),
        base.collection('participants').snapshots(),
        base.collection('candidateSlots').orderBy('startDateTime').snapshots(),
        base.collection('votes').snapshots(),
        base.collection('routes').snapshots(),
        base.collection('expenses').snapshots(),
        base.collection('contentOptions').snapshots(),
        base.collection('contentVotes').snapshots(),
        base.collection('planItems').orderBy('order').snapshots(),
        (meetupSnapshot,
            participantsSnapshot,
            slotsSnapshot,
            votesSnapshot,
            routesSnapshot,
            expensesSnapshot,
            contentOptionsSnapshot,
            contentVotesSnapshot,
            planItemsSnapshot) {
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
            previousConfirmedDateTime: _date(data['previousConfirmedDateTime']),
            scheduleChangedAt: _date(data['scheduleChangedAt']),
            meetingPlace: data['meetingPlace'] == null
                ? null
                : _location(
                    Map<String, dynamic>.from(data['meetingPlace'] as Map)),
            targetArrivalTime: _date(data['targetArrivalTime']),
            collectOrigins: data['collectOrigins'] as bool? ?? true,
            allowParticipantSlotAdd:
                data['allowParticipantSlotAdd'] as bool? ?? false,
            responseDeadline: _date(data['responseDeadline']),
            contentVoteConfig: _contentVoteConfig(data['contentVoteConfig']),
            allowPlanEditing: data['allowPlanEditing'] as bool? ?? false),
        participants: participantsSnapshot.docs.map((doc) {
          final item = doc.data();
          return Participant(
              uid: item['uid'] as String,
              displayName: item['displayName'] as String,
              isGuest: item['isGuest'] as bool,
              isHost: item['isHost'] as bool,
              hasOrigin: item['hasOrigin'] as bool? ?? false,
              originArea: item['originArea'] as String?,
              confirmedScheduleAvailability:
                  item['confirmedScheduleAvailability'] == null
                      ? null
                      : VoteStatusValue.fromValue(
                          item['confirmedScheduleAvailability'] as String));
        }).toList(),
        candidateSlots: slotsSnapshot.docs.map((doc) {
          final item = doc.data();
          return CandidateSlot(
              id: doc.id,
              startDateTime: _date(item['startDateTime'])!,
              createdByUid: item['createdByUid'] as String?);
        }).toList(),
        votes: votesSnapshot.docs.map((doc) {
          final item = doc.data();
          return AvailabilityVote(
              participantUid: item['participantUid'] as String,
              slotId: item['slotId'] as String,
              status: VoteStatusValue.fromValue(item['status'] as String),
              comment: item['comment'] as String?);
        }).toList(),
        routes: routesSnapshot.docs.map((doc) {
          final item = doc.data();
          return ParticipantRoute(
              participantUid: item['participantUid'] as String,
              originName: item['originName'] as String?,
              destinationName: item['destinationName'] as String?,
              durationMinutes: item['durationMinutes'] as int,
              transfers: item['transfers'] as int? ?? 0,
              routeSummary: item['routeSummary'] as String,
              isEstimate: item['isEstimate'] as bool? ?? false,
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
        contentOptions: contentOptionsSnapshot.docs.map((doc) {
          final item = doc.data();
          return ContentOption(
              id: doc.id,
              category:
                  ContentCategoryValue.fromValue(item['category'] as String),
              label: item['label'] as String,
              createdByUid: item['createdByUid'] as String,
              builtIn: item['builtIn'] as bool? ?? false);
        }).toList(),
        contentVotes: contentVotesSnapshot.docs.map((doc) {
          final item = doc.data();
          return ContentVote(
              participantUid: item['participantUid'] as String,
              optionId: item['optionId'] as String,
              category:
                  ContentCategoryValue.fromValue(item['category'] as String));
        }).toList(),
        planItems: planItemsSnapshot.docs.map((doc) {
          final item = doc.data();
          return PlanItem(
              id: doc.id,
              type: PlanItemTypeValue.fromValue(item['type'] as String),
              title: item['title'] as String,
              status: PlanItemStatus.values.firstWhere(
                  (status) => status.name == item['status'],
                  orElse: () => PlanItemStatus.planned),
              order: (item['order'] as num).toInt(),
              createdByUid: item['createdByUid'] as String,
              place: item['place'] == null
                  ? null
                  : _location(Map<String, dynamic>.from(item['place'] as Map)),
              scheduledAt: _date(item['scheduledAt']),
              note: item['note'] as String?,
              source: item['source'] as String? ?? 'manual');
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
  RelationshipStat _relationship(Map<String, dynamic> data) => RelationshipStat(
      otherUid: data['otherUid'] as String,
      displayName: data['displayName'] as String,
      sharedMeetupCount: (data['sharedMeetupCount'] as num).toInt(),
      lastMeetupId: data['lastMeetupId'] as String?);
  Location _location(Map<String, dynamic> data) => Location(
      placeId: data['placeId'] as String,
      name: data['name'] as String,
      address: data['address'] as String?,
      latitude: (data['latitude'] as num).toDouble(),
      longitude: (data['longitude'] as num).toDouble());
  ContentVoteConfig _contentVoteConfig(dynamic value) {
    final data = value is Map
        ? Map<String, dynamic>.from(value)
        : const <String, dynamic>{};
    return ContentVoteConfig(
        food: data['food'] as bool? ?? false,
        activity: data['activity'] as bool? ?? false,
        allowMultiple: data['allowMultiple'] as bool? ?? false,
        allowParticipantOptions:
            data['allowParticipantOptions'] as bool? ?? true);
  }

  PlaceVisit _placeVisit(Map<String, dynamic> data) => PlaceVisit(
      place: _location(Map<String, dynamic>.from(data['place'] as Map)),
      count: (data['count'] as num).toInt(),
      meetupIds: List<String>.from(data['meetupIds'] as List));
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
  DateTime? _isoDate(dynamic value) =>
      value is String ? DateTime.parse(value).toLocal() : null;
}

/// Emits a combined value whenever the meetup document or a child collection
/// changes. This keeps every collaborative panel in one coherent read model.
Stream<R> _combine9<A, B, C, D, E, F, G, H, I, R>(
    Stream<A> first,
    Stream<B> second,
    Stream<C> third,
    Stream<D> fourth,
    Stream<E> fifth,
    Stream<F> sixth,
    Stream<G> seventh,
    Stream<H> eighth,
    Stream<I> ninth,
    R Function(A, B, C, D, E, F, G, H, I) build) {
  late StreamController<R> controller;
  A? a;
  B? b;
  C? c;
  D? d;
  E? e;
  F? f;
  G? g;
  H? h;
  I? i;
  void emit() {
    if (a != null &&
        b != null &&
        c != null &&
        d != null &&
        e != null &&
        f != null &&
        g != null &&
        h != null &&
        i != null) {
      controller.add(build(a as A, b as B, c as C, d as D, e as E, f as F,
          g as G, h as H, i as I));
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
      }, onError: controller.addError),
      seventh.listen((value) {
        g = value;
        emit();
      }, onError: controller.addError),
      eighth.listen((value) {
        h = value;
        emit();
      }, onError: controller.addError),
      ninth.listen((value) {
        i = value;
        emit();
      }, onError: controller.addError)
    ];
    controller.onCancel = () =>
        Future.wait(subscriptions.map((subscription) => subscription.cancel()));
  });
  return controller.stream;
}
