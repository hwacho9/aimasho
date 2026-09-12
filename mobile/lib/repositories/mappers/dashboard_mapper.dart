import '../../models/meetup.dart';

HomeDashboard mapHomeDashboard(Map<String, dynamic> data) {
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
            meetingPlace: _optionalLocation(value['meetingPlace']),
            roomId: value['roomId'] as String?,
            roomName: value['roomName'] as String?);
      }).toList(),
      relationships: (data['relationships'] as List<dynamic>)
          .map((item) => _relationship(Map<String, dynamic>.from(item as Map)))
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
          upcomingMeetupCount: (summary['upcomingMeetupCount'] as num).toInt(),
          completedMeetupCount:
              (summary['completedMeetupCount'] as num).toInt(),
          friendCount: (summary['friendCount'] as num).toInt(),
          groupCount: (summary['groupCount'] as num).toInt()));
}

DateTime? _isoDate(dynamic value) =>
    value is String ? DateTime.parse(value).toLocal() : null;

Location? _optionalLocation(dynamic value) =>
    value == null ? null : _location(Map<String, dynamic>.from(value as Map));

Location _location(Map<String, dynamic> data) => Location(
    placeId: data['placeId'] as String,
    name: data['name'] as String,
    address: data['address'] as String?,
    latitude: (data['latitude'] as num).toDouble(),
    longitude: (data['longitude'] as num).toDouble());

RelationshipStat _relationship(Map<String, dynamic> data) => RelationshipStat(
    otherUid: data['otherUid'] as String,
    displayName: data['displayName'] as String,
    sharedMeetupCount: (data['sharedMeetupCount'] as num).toInt(),
    lastMeetupId: data['lastMeetupId'] as String?);
