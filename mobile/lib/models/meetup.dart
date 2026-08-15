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
      this.meetingPlace,
      this.targetArrivalTime});
  final String id;
  final String title;
  final String? description;
  final String createdByUid;
  final String status;
  final int durationMinutes;
  final DateTime? confirmedDateTime;
  final Location? meetingPlace;
  final DateTime? targetArrivalTime;
  bool get isConfirmed => status == 'SCHEDULE_CONFIRMED';
}

class Participant {
  const Participant(
      {required this.uid,
      required this.displayName,
      required this.isGuest,
      required this.isHost,
      this.hasOrigin = false,
      this.originArea});
  final String uid;
  final String displayName;
  final bool isGuest;
  final bool isHost;
  final bool hasOrigin;
  final String? originArea;
}

class CandidateSlot {
  const CandidateSlot({required this.id, required this.startDateTime});
  final String id;
  final DateTime startDateTime;
}

class AvailabilityVote {
  const AvailabilityVote(
      {required this.participantUid,
      required this.slotId,
      required this.status});
  final String participantUid;
  final String slotId;
  final VoteStatus status;
}

class MeetupDetail {
  const MeetupDetail(
      {required this.meetup,
      required this.participants,
      required this.candidateSlots,
      required this.votes,
      required this.routes,
      required this.expenses});
  final Meetup meetup;
  final List<Participant> participants;
  final List<CandidateSlot> candidateSlots;
  final List<AvailabilityVote> votes;
  final List<ParticipantRoute> routes;
  final List<Expense> expenses;
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
      required this.durationMinutes,
      required this.transfers,
      required this.routeSummary,
      required this.externalMapsUrl,
      required this.departureTime,
      required this.arrivalTime});
  final String participantUid;
  final int durationMinutes;
  final int transfers;
  final String routeSummary;
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
      {required this.room, required this.members, required this.meetups});
  final Room room;
  final List<RoomMember> members;
  final List<RoomMeetup> meetups;
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
      this.confirmedDateTime});
  final String id;
  final String title;
  final String status;
  final DateTime? confirmedDateTime;
}
