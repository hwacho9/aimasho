/// Shared presentation rules for meetup, relationship, and profile screens.
///
/// Keeping these labels here prevents small wording differences between the
/// home, profile, meetup, and group surfaces.
String meetupStatusLabel(String status) => switch (status) {
      'SCHEDULING' => '날짜 조율 중',
      'SCHEDULE_CONFIRMED' => '날짜 확정',
      'LOCATION_COLLECTING' => '출발지 수집 중',
      'LOCATION_SELECTING' => '장소 선택 중',
      'LOCATION_CONFIRMED' => '장소 확정',
      'READY' => '준비 완료',
      'COMPLETED' => '완료',
      'CANCELLED' => '취소',
      _ => status.replaceAll('_', ' '),
    };

String relationshipLabel(int sharedMeetupCount) {
  if (sharedMeetupCount >= 8) return '찐친';
  if (sharedMeetupCount >= 4) return '자주 만나는 친구';
  if (sharedMeetupCount >= 2) return '함께 만나는 사이';
  return '새로운 친구';
}

String displayInitial(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) return '?';
  return String.fromCharCode(trimmed.runes.first);
}
