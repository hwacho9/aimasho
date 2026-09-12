import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../presentation/meetup_presentation.dart';
import '../../providers/meetup_providers.dart';
import 'meetup_lifecycle.dart';
import '../social/memory_notes_panel.dart';

part 'meetup_management_section.dart';
part 'meetup_planning_sections.dart';
part 'meetup_schedule_sections.dart';

class MeetupScreen extends ConsumerWidget {
  const MeetupScreen({super.key, required this.meetupId});
  final String meetupId;
  static final _dateFormat = DateFormat('M月d日 (E) HH:mm', 'ja');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meetup = ref.watch(meetupProvider(meetupId));
    final uid = ref.watch(currentUidProvider).valueOrNull;
    return meetup.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
          body: Center(
              child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text('약속을 불러올 수 없어요.\n$error',
                      textAlign: TextAlign.center)))),
      data: (detail) {
        final mine = _participantFor(detail.participants, uid);
        final isHost = mine?.isHost ?? false;
        final recommendation = ref.watch(recommendationProvider(meetupId));
        final relationships = ref.watch(meetupRelationshipsProvider(meetupId));
        final scheduleOpen = detail.meetup.canEditScheduleAt(DateTime.now());
        CandidateSlot? confirmedSlot;
        if (detail.meetup.confirmedDateTime != null) {
          for (final slot in detail.candidateSlots) {
            if (slot.startDateTime.toUtc() ==
                detail.meetup.confirmedDateTime!.toUtc()) {
              confirmedSlot = slot;
              break;
            }
          }
        }
        final otherSlots = detail.candidateSlots
            .where((slot) => slot.id != confirmedSlot?.id)
            .toList();
        return Scaffold(
          appBar: AppBar(
              title: const Text('aimasho',
                  style: TextStyle(fontWeight: FontWeight.w800))),
          body: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(recommendationProvider(meetupId));
              ref.invalidate(meetupRelationshipsProvider(meetupId));
              await ref.read(recommendationProvider(meetupId).future);
            },
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 38),
                children: [
                  _Header(
                      detail: detail,
                      relationships: relationships.valueOrNull ?? const []),
                  if (detail.meetup.previousConfirmedDateTime != null &&
                      detail.meetup.confirmedDateTime != null)
                    _ScheduleChangedNotice(
                        previous: detail.meetup.previousConfirmedDateTime!,
                        current: detail.meetup.confirmedDateTime!),
                  if (!detail.meetup.isFinished)
                    _InviteHint(meetupId: meetupId, title: detail.meetup.title),
                  if (!detail.meetup.isConfirmed &&
                      detail.meetup.responseDeadline != null)
                    _ResponseDeadlineNotice(
                        deadline: detail.meetup.responseDeadline!,
                        passed: !scheduleOpen),
                  const SizedBox(height: 25),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('WHEN',
                                  style: TextStyle(
                                      fontSize: 11,
                                      color: AimashoColors.coral,
                                      letterSpacing: 1.2,
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 5),
                              Text(
                                  detail.meetup.isConfirmed
                                      ? '정해진 일정'
                                      : '언제가 좋아요?',
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleLarge
                                      ?.copyWith(fontWeight: FontWeight.w800))
                            ]),
                        Text(
                            '${detail.votes.length}/${detail.participants.length * detail.candidateSlots.length} 응답',
                            style: const TextStyle(
                                color: AimashoColors.muted, fontSize: 12))
                      ]),
                  const SizedBox(height: 12),
                  if (confirmedSlot != null)
                    _ScheduleCard(
                        meetupId: meetupId,
                        detail: detail,
                        slot: confirmedSlot,
                        uid: uid,
                        recommendation: recommendation.valueOrNull,
                        onChanged: () =>
                            ref.invalidate(recommendationProvider(meetupId)))
                  else
                    ...detail.candidateSlots.map((slot) => _ScheduleCard(
                        meetupId: meetupId,
                        detail: detail,
                        slot: slot,
                        uid: uid,
                        recommendation: recommendation.valueOrNull,
                        onChanged: () =>
                            ref.invalidate(recommendationProvider(meetupId)))),
                  if (detail.meetup.isConfirmed && otherSlots.isNotEmpty)
                    Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                            border: Border.all(color: AimashoColors.line),
                            borderRadius: BorderRadius.circular(16)),
                        child: ExpansionTile(
                            title: const Text('투표 결과와 다른 후보',
                                style: TextStyle(
                                    fontSize: 13, fontWeight: FontWeight.w800)),
                            subtitle: Text(
                                '${otherSlots.length}개 · 언제든 내 선택 수정',
                                style: const TextStyle(fontSize: 11)),
                            childrenPadding: const EdgeInsets.all(10),
                            children: otherSlots
                                .map((slot) => _ScheduleCard(
                                    meetupId: meetupId,
                                    detail: detail,
                                    slot: slot,
                                    uid: uid,
                                    recommendation: recommendation.valueOrNull,
                                    onChanged: () => ref.invalidate(
                                        recommendationProvider(meetupId))))
                                .toList())),
                  if (scheduleOpen &&
                      (isHost || detail.meetup.allowParticipantSlotAdd))
                    _AddCandidateSlotCard(meetupId: meetupId),
                  if (detail.meetup.isConfirmed && mine != null)
                    _ConfirmedScheduleAvailabilityCard(
                        meetupId: meetupId,
                        availability: mine.confirmedScheduleAvailability,
                        changed:
                            detail.meetup.previousConfirmedDateTime != null),
                  if (!detail.meetup.isFinished &&
                      detail.meetup.confirmedDateTime != null &&
                      detail.meetup.confirmedDateTime!
                          .isAfter(DateTime.now()) &&
                      mine != null)
                    _MeetupReminderCard(
                        meetupId: meetupId, enabled: mine.remindersEnabled),
                  if (isHost &&
                      detail.meetup.isConfirmed &&
                      detail.meetup.confirmedDateTime != null)
                    _ScheduleChangeCard(
                        meetupId: meetupId,
                        confirmedDateTime: detail.meetup.confirmedDateTime!),
                  if (isHost &&
                      !detail.meetup.isConfirmed &&
                      recommendation.hasValue &&
                      recommendation.value!.recommended != null)
                    _RecommendationCard(
                        meetupId: meetupId,
                        recommended: recommendation.value!.recommended!,
                        busy: false),
                  if (detail.meetup.contentVoteConfig.isEnabled)
                    _ContentVotingPanel(
                        meetupId: meetupId,
                        detail: detail,
                        uid: uid,
                        isHost: isHost),
                  _EventPlanPanel(
                      meetupId: meetupId,
                      detail: detail,
                      uid: uid,
                      canEdit: isHost || detail.meetup.allowPlanEditing),
                  MeetupLifecycle(
                      meetupId: meetupId,
                      detail: detail,
                      currentUid: uid,
                      isHost: isHost),
                  if (detail.meetup.status == 'COMPLETED')
                    Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: MemoryNotesPanel(
                            key: ValueKey('$meetupId:$uid'),
                            meetupId: meetupId)),
                  if (isHost)
                    _MeetupManagementPanel(meetupId: meetupId, detail: detail),
                ]),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.detail, required this.relationships});
  final MeetupDetail detail;
  final List<RelationshipStat> relationships;
  @override
  Widget build(BuildContext context) {
    final confirmedText = detail.meetup.confirmedDateTime == null
        ? null
        : DateFormat('M月d日 HH:mm', 'ja')
            .format(detail.meetup.confirmedDateTime!);
    return Column(children: [
      Transform.rotate(
          angle: -.12,
          child: Container(
              width: 48,
              height: 48,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                  color: Color(0xFFFFE1CA),
                  borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(17),
                      topRight: Radius.circular(17),
                      bottomRight: Radius.circular(17),
                      bottomLeft: Radius.circular(5))),
              child: const Text('☀',
                  style: TextStyle(fontSize: 27, color: Color(0xFFEC9255))))),
      const SizedBox(height: 14),
      Text(detail.meetup.isConfirmed ? 'DATE CONFIRMED' : 'SCHEDULING',
          style: const TextStyle(
              fontSize: 11,
              color: AimashoColors.coral,
              letterSpacing: 1.2,
              fontWeight: FontWeight.w800)),
      const SizedBox(height: 5),
      Text(detail.meetup.title,
          textAlign: TextAlign.center,
          style: Theme.of(context)
              .textTheme
              .headlineSmall
              ?.copyWith(fontWeight: FontWeight.w800)),
      if (detail.meetup.description != null)
        Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(detail.meetup.description!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AimashoColors.muted))),
      if (confirmedText != null)
        Padding(
            padding: const EdgeInsets.only(top: 13),
            child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                decoration: BoxDecoration(
                    color: const Color(0xFFE5F6EA),
                    borderRadius: BorderRadius.circular(99)),
                child: Text('✓ $confirmedText로 확정됐어요',
                    style: const TextStyle(
                        color: Color(0xFF36855A),
                        fontSize: 12,
                        fontWeight: FontWeight.w800)))),
      const SizedBox(height: 16),
      Text(
          '${detail.participants.map((participant) => participant.displayName).join(' · ')}  ·  ${detail.participants.length}명 참여',
          style: const TextStyle(color: AimashoColors.muted, fontSize: 12)),
      if (relationships.isNotEmpty)
        Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 16),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: const Color(0xFFFFF4ED),
                borderRadius: BorderRadius.circular(12)),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: relationships
                    .map((relationship) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(children: [
                          Expanded(
                              child: Text(
                                  '${relationship.displayName} · 함께한 약속 ${relationship.sharedMeetupCount}회',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700))),
                          Text(
                              relationshipLabel(relationship.sharedMeetupCount),
                              style: const TextStyle(
                                  color: AimashoColors.coral,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800))
                        ])))
                    .toList()))
    ]);
  }
}

class _InviteHint extends StatelessWidget {
  const _InviteHint({required this.meetupId, required this.title});
  final String meetupId;
  final String title;
  String get _url => 'https://aimasho.web.app/m/$meetupId';

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 22),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
          color: const Color(0xFFFFE5D6),
          borderRadius: BorderRadius.circular(20)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('✦  친구를 초대해주세요',
            style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('공유 링크를 열면 로그인 없이 바로 참여하고 투표할 수 있어요.',
            style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
        const SizedBox(height: 10),
        SelectableText(_url,
            style: const TextStyle(
                fontSize: 12,
                color: AimashoColors.coral,
                fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        Row(children: [
          Expanded(
              child: OutlinedButton.icon(
                  onPressed: () => Share.share('$title 약속에 초대해요!\n$_url',
                      subject: '$title · aimasho 약속 초대'),
                  icon: const Icon(Icons.ios_share_rounded, size: 17),
                  label: const Text('초대 보내기'))),
          const SizedBox(width: 8),
          IconButton.outlined(
              tooltip: '링크 복사',
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: _url));
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('초대 링크를 복사했어요.')));
                }
              },
              icon: const Icon(Icons.link_rounded))
        ])
      ]));
}

Participant? _participantFor(List<Participant> participants, String? uid) {
  for (final participant in participants) {
    if (participant.uid == uid) return participant;
  }
  return null;
}
