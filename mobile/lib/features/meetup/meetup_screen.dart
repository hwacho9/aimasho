import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';
import 'meetup_lifecycle.dart';

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
        return Scaffold(
          appBar: AppBar(
              title: const Text('aimasho',
                  style: TextStyle(fontWeight: FontWeight.w800))),
          body: RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(recommendationProvider(meetupId));
              await ref.read(recommendationProvider(meetupId).future);
            },
            child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 38),
                children: [
                  _Header(detail: detail),
                  if (isHost && !detail.meetup.isConfirmed)
                    _InviteHint(meetupId: meetupId),
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
                  ...detail.candidateSlots.map((slot) => _ScheduleCard(
                      meetupId: meetupId,
                      detail: detail,
                      slot: slot,
                      uid: uid,
                      recommendation: recommendation.valueOrNull,
                      onChanged: () =>
                          ref.invalidate(recommendationProvider(meetupId)))),
                  if (isHost &&
                      !detail.meetup.isConfirmed &&
                      recommendation.hasValue &&
                      recommendation.value!.recommended != null)
                    _RecommendationCard(
                        meetupId: meetupId,
                        recommended: recommendation.value!.recommended!,
                        busy: false),
                  MeetupLifecycle(
                      meetupId: meetupId,
                      detail: detail,
                      currentUid: uid,
                      isHost: isHost),
                ]),
          ),
        );
      },
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.detail});
  final MeetupDetail detail;
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
    ]);
  }
}

class _InviteHint extends StatelessWidget {
  const _InviteHint({required this.meetupId});
  final String meetupId;
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
        const Text('공유 링크를 열면 로그인 없이 바로 투표할 수 있어요.',
            style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
        const SizedBox(height: 10),
        SelectableText('https://aimasho.app/m/$meetupId',
            style: const TextStyle(
                fontSize: 12,
                color: AimashoColors.coral,
                fontWeight: FontWeight.w700))
      ]));
}

Participant? _participantFor(List<Participant> participants, String? uid) {
  for (final participant in participants) {
    if (participant.uid == uid) return participant;
  }
  return null;
}

class _ScheduleCard extends ConsumerStatefulWidget {
  const _ScheduleCard(
      {required this.meetupId,
      required this.detail,
      required this.slot,
      required this.uid,
      required this.recommendation,
      required this.onChanged});
  final String meetupId;
  final MeetupDetail detail;
  final CandidateSlot slot;
  final String? uid;
  final Recommendation? recommendation;
  final VoidCallback onChanged;
  @override
  ConsumerState<_ScheduleCard> createState() => _ScheduleCardState();
}

class _ScheduleCardState extends ConsumerState<_ScheduleCard> {
  bool _saving = false;
  Future<void> _vote(VoteStatus status) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .submitVote(widget.meetupId, widget.slot.id, status);
      widget.onChanged();
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('투표를 저장하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = widget.recommendation?.ranking
        .where((item) => item.id == widget.slot.id)
        .fold<RecommendationSlot?>(null, (_, item) => item);
    final recommended =
        widget.recommendation?.recommended?.id == widget.slot.id &&
            !widget.detail.meetup.isConfirmed;
    final myVote = widget.detail.votes
        .where((vote) =>
            vote.participantUid == widget.uid && vote.slotId == widget.slot.id)
        .fold<AvailabilityVote?>(null, (_, vote) => vote);
    final confirmed = widget.detail.meetup.confirmedDateTime?.toUtc() ==
        widget.slot.startDateTime.toUtc();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: confirmed
              ? const Color(0xFFF6FCF8)
              : recommended
                  ? const Color(0xFFFFFAF2)
                  : const Color(0xFFFFFEFB),
          borderRadius: BorderRadius.circular(19),
          border: Border.all(
              color: confirmed
                  ? const Color(0xFF7BBB96)
                  : recommended
                      ? const Color(0xFFF29A64)
                      : AimashoColors.line,
              width: recommended ? 2 : 1)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
              child: Text(
                  MeetupScreen._dateFormat.format(widget.slot.startDateTime),
                  style: const TextStyle(
                      fontSize: 16, fontWeight: FontWeight.w800))),
          if (recommended)
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    color: const Color(0xFFFFF0D9),
                    borderRadius: BorderRadius.circular(99)),
                child: const Text('aimasho 추천',
                    style: TextStyle(
                        fontSize: 10,
                        color: Color(0xFFD97938),
                        fontWeight: FontWeight.w800)))
        ]),
        if (result != null)
          Padding(
              padding: const EdgeInsets.only(top: 11),
              child: Row(children: [
                Text('○ ${result.yes}',
                    style: const TextStyle(
                        color: AimashoColors.green,
                        fontWeight: FontWeight.w800)),
                const SizedBox(width: 12),
                Text('△ ${result.maybe}',
                    style: const TextStyle(
                        color: AimashoColors.yellow,
                        fontWeight: FontWeight.w800)),
                const SizedBox(width: 12),
                Text('× ${result.no}',
                    style: const TextStyle(
                        color: AimashoColors.red, fontWeight: FontWeight.w800)),
                if (result.no == 0 &&
                    result.yes == widget.detail.participants.length)
                  const Spacer(),
                if (result.no == 0 &&
                    result.yes == widget.detail.participants.length)
                  const Text('모두 가능해요!',
                      style: TextStyle(
                          fontSize: 11,
                          color: AimashoColors.green,
                          fontWeight: FontWeight.w800))
              ])),
        if (!widget.detail.meetup.isConfirmed && widget.uid != null)
          Padding(
              padding: const EdgeInsets.only(top: 14),
              child: _VoteSelector(
                  value: myVote?.status, saving: _saving, onSelect: _vote)),
      ]),
    );
  }
}

class _VoteSelector extends StatelessWidget {
  const _VoteSelector(
      {required this.value, required this.saving, required this.onSelect});
  final VoteStatus? value;
  final bool saving;
  final ValueChanged<VoteStatus> onSelect;
  @override
  Widget build(BuildContext context) => Row(
          children: VoteStatus.values.map((status) {
        final selected = status == value;
        final color = switch (status) {
          VoteStatus.yes => AimashoColors.green,
          VoteStatus.maybe => AimashoColors.yellow,
          VoteStatus.no => AimashoColors.red
        };
        return Expanded(
            child: Padding(
                padding:
                    EdgeInsets.only(left: status == VoteStatus.yes ? 0 : 6),
                child: OutlinedButton(
                    onPressed: saving ? null : () => onSelect(status),
                    style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 43),
                        foregroundColor: selected ? color : AimashoColors.muted,
                        backgroundColor:
                            selected ? color.withOpacity(.11) : Colors.white,
                        side: BorderSide(
                            color: selected ? color : AimashoColors.line),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12))),
                    child: Text('${status.symbol} ${status.label}',
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w800)))));
      }).toList());
}

class _RecommendationCard extends ConsumerStatefulWidget {
  const _RecommendationCard(
      {required this.meetupId, required this.recommended, required this.busy});
  final String meetupId;
  final RecommendationSlot recommended;
  final bool busy;
  @override
  ConsumerState<_RecommendationCard> createState() =>
      _RecommendationCardState();
}

class _RecommendationCardState extends ConsumerState<_RecommendationCard> {
  bool _confirming = false;
  Future<void> _confirm() async {
    setState(() => _confirming = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .confirmSchedule(widget.meetupId, widget.recommended.id);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('일정을 확정하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(21),
      decoration: BoxDecoration(
          color: const Color(0xFFFCE8D9),
          borderRadius: BorderRadius.circular(21)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('✦  AIMASHO PICK',
            style: TextStyle(
                color: AimashoColors.coral,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 7),
        Text(MeetupScreen._dateFormat.format(widget.recommended.startDateTime),
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text('불가능한 사람이 가장 적고, 가장 많은 친구가 참여할 수 있어요.',
            style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
        const SizedBox(height: 18),
        ElevatedButton(
            onPressed: _confirming ? null : _confirm,
            child: Text(_confirming ? '확정 중...' : '이 일정으로 결정'))
      ]));
}
