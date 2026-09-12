import 'package:aimasho/presentation/meetup_presentation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('maps meetup lifecycle states to consistent labels', () {
    expect(meetupStatusLabel('SCHEDULING'), '날짜 조율 중');
    expect(meetupStatusLabel('LOCATION_CONFIRMED'), '장소 확정');
    expect(meetupStatusLabel('COMPLETED'), '완료');
  });

  test('maps shared meetup counts to relationship levels', () {
    expect(relationshipLabel(1), '새로운 친구');
    expect(relationshipLabel(2), '함께 만나는 사이');
    expect(relationshipLabel(4), '자주 만나는 친구');
    expect(relationshipLabel(8), '찐친');
  });

  test('creates a safe profile initial', () {
    expect(displayInitial('  성화  '), '성');
    expect(displayInitial(''), '?');
  });
}
