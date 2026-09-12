import 'package:aimasho/repositories/mappers/dashboard_mapper.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps the callable dashboard payload without Firebase', () {
    final dashboard = mapHomeDashboard({
      'displayName': '성화',
      'meetups': [
        {
          'id': 'meetup-1',
          'title': '저녁 약속',
          'status': 'SCHEDULING',
          'candidateDateTimes': ['2026-09-01T10:00:00.000Z'],
          'isOwner': true,
        }
      ],
      'relationships': [
        {
          'otherUid': 'friend-1',
          'displayName': '유키',
          'sharedMeetupCount': 3,
        }
      ],
      'rooms': [
        {
          'id': 'room-1',
          'name': '친구들',
          'inviteCode': 'ABC1234',
          'role': 'OWNER',
          'completedMeetupCount': 2,
        }
      ],
      'summary': {
        'upcomingMeetupCount': 1,
        'completedMeetupCount': 2,
        'friendCount': 1,
        'groupCount': 1,
      }
    });

    expect(dashboard.displayName, '성화');
    expect(dashboard.meetups.single.isOwner, isTrue);
    expect(dashboard.relationships.single.sharedMeetupCount, 3);
    expect(dashboard.rooms.single.completedMeetupCount, 2);
  });
}
