enum VoteStatus { yes, maybe, no }

extension VoteStatusValue on VoteStatus {
  String get value => switch (this) {
        VoteStatus.yes => 'YES',
        VoteStatus.maybe => 'MAYBE',
        VoteStatus.no => 'NO'
      };
  String get symbol => switch (this) {
        VoteStatus.yes => '○',
        VoteStatus.maybe => '△',
        VoteStatus.no => '×'
      };
  String get label => switch (this) {
        VoteStatus.yes => '가능',
        VoteStatus.maybe => '애매',
        VoteStatus.no => '불가능'
      };
  static VoteStatus fromValue(String value) => switch (value) {
        'YES' => VoteStatus.yes,
        'MAYBE' => VoteStatus.maybe,
        _ => VoteStatus.no
      };
}

class Meetup {
  const Meetup(
      {required this.id,
      required this.title,
      required this.createdByUid,
      required this.status,
      required this.durationMinutes,
      this.description,
      this.confirmedDateTime,
      this.previousConfirmedDateTime,
      this.scheduleChangedAt,
      this.meetingPlace,
      this.targetArrivalTime,
      this.collectOrigins = true,
      this.allowParticipantSlotAdd = false,
      this.responseDeadline,
      this.contentVoteConfig = const ContentVoteConfig(),
      this.allowPlanEditing = false});
  final String id;
  final String title;
  final String? description;
  final String createdByUid;
  final String status;
  final int durationMinutes;
  final DateTime? confirmedDateTime;
  final DateTime? previousConfirmedDateTime;
  final DateTime? scheduleChangedAt;
  final Location? meetingPlace;
  final DateTime? targetArrivalTime;
  final bool collectOrigins;
  final bool allowParticipantSlotAdd;
  final DateTime? responseDeadline;
  final ContentVoteConfig contentVoteConfig;
  final bool allowPlanEditing;
  bool get isConfirmed => status != 'SCHEDULING';
  bool get isFinished => status == 'COMPLETED' || status == 'CANCELLED';
}

class Participant {
  const Participant(
      {required this.uid,
      required this.displayName,
      required this.isGuest,
      required this.isHost,
      this.hasOrigin = false,
      this.originArea,
      this.confirmedScheduleAvailability});
  final String uid;
  final String displayName;
  final bool isGuest;
  final bool isHost;
  final bool hasOrigin;
  final String? originArea;
  final VoteStatus? confirmedScheduleAvailability;
}

class RelationshipStat {
  const RelationshipStat(
      {required this.otherUid,
      required this.displayName,
      required this.sharedMeetupCount,
      this.lastMeetupId});
  final String otherUid;
  final String displayName;
  final int sharedMeetupCount;
  final String? lastMeetupId;
}

class CandidateSlot {
  const CandidateSlot(
      {required this.id, required this.startDateTime, this.createdByUid});
  final String id;
  final DateTime startDateTime;
  final String? createdByUid;
}

class AvailabilityVote {
  const AvailabilityVote(
      {required this.participantUid,
      required this.slotId,
      required this.status,
      this.comment});
  final String participantUid;
  final String slotId;
  final VoteStatus status;
  final String? comment;
}

enum ContentCategory { food, activity }

extension ContentCategoryValue on ContentCategory {
  String get value => this == ContentCategory.food ? 'FOOD' : 'ACTIVITY';
  String get label => this == ContentCategory.food ? '먹고 싶은 것' : '하고 싶은 것';

  static ContentCategory fromValue(String value) =>
      value == 'ACTIVITY' ? ContentCategory.activity : ContentCategory.food;
}

class ContentVoteConfig {
  const ContentVoteConfig(
      {this.food = false,
      this.activity = false,
      this.allowMultiple = false,
      this.allowParticipantOptions = true});
  final bool food;
  final bool activity;
  final bool allowMultiple;
  final bool allowParticipantOptions;
  bool get isEnabled => food || activity;
}

class ContentOption {
  const ContentOption(
      {required this.id,
      required this.category,
      required this.label,
      required this.createdByUid,
      this.builtIn = false});
  final String id;
  final ContentCategory category;
  final String label;
  final String createdByUid;
  final bool builtIn;
}

class ContentVote {
  const ContentVote(
      {required this.participantUid,
      required this.optionId,
      required this.category});
  final String participantUid;
  final String optionId;
  final ContentCategory category;
}

enum PlanItemType { meet, food, activity, cafe, move, other, end }

extension PlanItemTypeValue on PlanItemType {
  String get value => name;
  String get label => switch (this) {
        PlanItemType.meet => '집합',
        PlanItemType.food => '식사',
        PlanItemType.activity => '활동',
        PlanItemType.cafe => '카페',
        PlanItemType.move => '이동',
        PlanItemType.other => '기타',
        PlanItemType.end => '해산'
      };
  String get emoji => switch (this) {
        PlanItemType.meet => '📍',
        PlanItemType.food => '🍽️',
        PlanItemType.activity => '✨',
        PlanItemType.cafe => '☕',
        PlanItemType.move => '🚇',
        PlanItemType.other => '📌',
        PlanItemType.end => '🏁'
      };

  static PlanItemType fromValue(String value) =>
      PlanItemType.values.firstWhere((item) => item.name == value,
          orElse: () => PlanItemType.other);
}

enum PlanItemStatus { planned, completed, skipped }

class PlanItem {
  const PlanItem(
      {required this.id,
      required this.type,
      required this.title,
      required this.status,
      required this.order,
      required this.createdByUid,
      this.place,
      this.scheduledAt,
      this.note,
      this.source = 'manual'});
  final String id;
  final PlanItemType type;
  final String title;
  final PlanItemStatus status;
  final int order;
  final String createdByUid;
  final Location? place;
  final DateTime? scheduledAt;
  final String? note;
  final String source;
}

class MeetupDetail {
  const MeetupDetail(
      {required this.meetup,
      required this.participants,
      required this.candidateSlots,
      required this.votes,
      required this.routes,
      required this.expenses,
      required this.contentOptions,
      required this.contentVotes,
      required this.planItems});
  final Meetup meetup;
  final List<Participant> participants;
  final List<CandidateSlot> candidateSlots;
  final List<AvailabilityVote> votes;
  final List<ParticipantRoute> routes;
  final List<Expense> expenses;
  final List<ContentOption> contentOptions;
  final List<ContentVote> contentVotes;
  final List<PlanItem> planItems;
}

class InvitePreview {
  const InvitePreview(
      {required this.meetupId,
      required this.title,
      required this.hostName,
      required this.isAlreadyParticipant});
  final String meetupId;
  final String title;
  final String hostName;
  final bool isAlreadyParticipant;
}

class RecommendationSlot {
  const RecommendationSlot(
      {required this.id,
      required this.startDateTime,
      required this.yes,
      required this.maybe,
      required this.no,
      required this.totalScore,
      required this.participantCount});
  final String id;
  final DateTime startDateTime;
  final int yes;
  final int maybe;
  final int no;
  final int totalScore;
  final int participantCount;
}

class Recommendation {
  const Recommendation({required this.recommended, required this.ranking});
  final RecommendationSlot? recommended;
  final List<RecommendationSlot> ranking;
}

class Location {
  const Location(
      {required this.placeId,
      required this.name,
      required this.latitude,
      required this.longitude,
      this.address});
  final String placeId;
  final String name;
  final String? address;
  final double latitude;
  final double longitude;
}

class MeetingPointCandidate extends Location {
  const MeetingPointCandidate(
      {required super.placeId,
      required super.name,
      required super.latitude,
      required super.longitude,
      super.address,
      required this.averageDurationMinutes,
      required this.maxDurationMinutes,
      required this.standardDeviationMinutes,
      required this.fairScore,
      required this.fastScore,
      required this.score,
      required this.participantDurations});
  final double averageDurationMinutes;
  final int maxDurationMinutes;
  final double standardDeviationMinutes;
  final double fairScore;
  final double fastScore;
  final double score;
  final List<ParticipantDuration> participantDurations;
}

class ParticipantDuration {
  const ParticipantDuration(
      {required this.participantUid, required this.durationMinutes});
  final String participantUid;
  final int durationMinutes;
}

class ParticipantRoute {
  const ParticipantRoute(
      {required this.participantUid,
      this.originName,
      this.destinationName,
      required this.durationMinutes,
      required this.transfers,
      required this.routeSummary,
      this.isEstimate = false,
      required this.externalMapsUrl,
      required this.departureTime,
      required this.arrivalTime});
  final String participantUid;
  final String? originName;
  final String? destinationName;
  final int durationMinutes;
  final int transfers;
  final String routeSummary;
  final bool isEstimate;
  final String externalMapsUrl;
  final DateTime departureTime;
  final DateTime arrivalTime;
}

class Expense {
  const Expense(
      {required this.id,
      required this.title,
      required this.amount,
      required this.paidByUid,
      required this.participantUids,
      required this.createdByUid});
  final String id;
  final String title;
  final int amount;
  final String paidByUid;
  final List<String> participantUids;
  final String createdByUid;
}

class Settlement {
  const Settlement(
      {required this.totalAmount,
      required this.balances,
      required this.transfers});
  final int totalAmount;
  final List<Balance> balances;
  final List<Transfer> transfers;
}

class Balance {
  const Balance({required this.participantUid, required this.amount});
  final String participantUid;
  final int amount;
}

class Transfer {
  const Transfer(
      {required this.fromUid, required this.toUid, required this.amount});
  final String fromUid;
  final String toUid;
  final int amount;
}

class Room {
  const Room(
      {required this.id,
      required this.name,
      required this.inviteCode,
      required this.role});
  final String id;
  final String name;
  final String inviteCode;
  final String role;
}

class RoomDetail {
  const RoomDetail(
      {required this.room,
      required this.members,
      required this.meetups,
      required this.ownerUid,
      this.summary = const RoomSummary(),
      this.mapPlaces = const []});
  final Room room;
  final List<RoomMember> members;
  final List<RoomMeetup> meetups;
  final String ownerUid;
  final RoomSummary summary;
  final List<PlaceVisit> mapPlaces;
}

class RoomSummary {
  const RoomSummary(
      {this.completedMeetupCount = 0,
      this.uniquePlaceCount = 0,
      this.mostVisitedPlace});
  final int completedMeetupCount;
  final int uniquePlaceCount;
  final PlaceVisit? mostVisitedPlace;
}

class PlaceVisit {
  const PlaceVisit(
      {required this.place, required this.count, required this.meetupIds});
  final Location place;
  final int count;
  final List<String> meetupIds;
}

class RoomMember {
  const RoomMember(
      {required this.uid, required this.displayName, required this.role});
  final String uid;
  final String displayName;
  final String role;
}

class RoomMeetup {
  const RoomMeetup(
      {required this.id,
      required this.title,
      required this.status,
      this.confirmedDateTime,
      this.completedAt,
      this.meetingPlace,
      this.occurrence});
  final String id;
  final String title;
  final String status;
  final DateTime? confirmedDateTime;
  final DateTime? completedAt;
  final Location? meetingPlace;
  final int? occurrence;
}

class DashboardSummary {
  const DashboardSummary(
      {required this.upcomingMeetupCount,
      required this.completedMeetupCount,
      required this.friendCount,
      required this.groupCount});
  final int upcomingMeetupCount;
  final int completedMeetupCount;
  final int friendCount;
  final int groupCount;
}

class DashboardMeetup {
  const DashboardMeetup(
      {required this.id,
      required this.title,
      required this.status,
      required this.candidateDateTimes,
      required this.isOwner,
      this.confirmedDateTime,
      this.completedAt,
      this.meetingPlace,
      this.roomId,
      this.roomName});
  final String id;
  final String title;
  final String status;
  final List<DateTime> candidateDateTimes;
  final bool isOwner;
  final DateTime? confirmedDateTime;
  final DateTime? completedAt;
  final Location? meetingPlace;
  final String? roomId;
  final String? roomName;
  DateTime? get displayDate =>
      confirmedDateTime ??
      (candidateDateTimes.isEmpty ? null : candidateDateTimes.first) ??
      completedAt;
  bool get isFinished => status == 'COMPLETED' || status == 'CANCELLED';
}

class DashboardRoom {
  const DashboardRoom(
      {required this.id,
      required this.name,
      required this.inviteCode,
      required this.role,
      required this.completedMeetupCount,
      this.nextMeetupDate});
  final String id;
  final String name;
  final String inviteCode;
  final String role;
  final int completedMeetupCount;
  final DateTime? nextMeetupDate;
}

class HomeDashboard {
  const HomeDashboard(
      {required this.displayName,
      required this.meetups,
      required this.relationships,
      required this.rooms,
      required this.summary});
  final String displayName;
  final List<DashboardMeetup> meetups;
  final List<RelationshipStat> relationships;
  final List<DashboardRoom> rooms;
  final DashboardSummary summary;
}

class FriendHistory {
  const FriendHistory(
      {required this.otherUid,
      required this.displayName,
      required this.completedMeetupCount,
      required this.meetups});
  final String otherUid;
  final String displayName;
  final int completedMeetupCount;
  final List<DashboardMeetup> meetups;
}
