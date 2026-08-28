import 'package:aimasho/models/meetup.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('dashboard meetup', () {
    test('keeps an owned meetup visible without any date', () {
      const meetup = DashboardMeetup(
          id: 'meetup-1',
          title: '아직 조율 중',
          status: 'SCHEDULING',
          candidateDateTimes: [],
          isOwner: true);

      expect(meetup.displayDate, isNull);
      expect(meetup.isOwner, isTrue);
      expect(meetup.isFinished, isFalse);
    });

    test('prefers the confirmed date over candidate dates', () {
      final confirmed = DateTime(2026, 9, 2, 19);
      final meetup = DashboardMeetup(
          id: 'meetup-2',
          title: '확정 일정',
          status: 'READY',
          candidateDateTimes: [DateTime(2026, 9, 1, 18)],
          confirmedDateTime: confirmed,
          isOwner: false);

      expect(meetup.displayDate, confirmed);
    });
  });

  test('content voting configuration reports enabled categories', () {
    const disabled = ContentVoteConfig();
    const enabled = ContentVoteConfig(food: true);

    expect(disabled.isEnabled, isFalse);
    expect(enabled.isEnabled, isTrue);
  });
}
