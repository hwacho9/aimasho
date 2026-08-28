import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

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
        final relationships = ref.watch(meetupRelationshipsProvider(meetupId));
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
                  if (!detail.meetup.isFinished &&
                      (isHost || detail.meetup.allowParticipantSlotAdd))
                    _AddCandidateSlotCard(meetupId: meetupId),
                  if (detail.meetup.isConfirmed && mine != null)
                    _ConfirmedScheduleAvailabilityCard(
                        meetupId: meetupId,
                        availability: mine.confirmedScheduleAvailability,
                        changed:
                            detail.meetup.previousConfirmedDateTime != null),
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
                              _relationshipLabel(
                                  relationship.sharedMeetupCount),
                              style: const TextStyle(
                                  color: AimashoColors.coral,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800))
                        ])))
                    .toList()))
    ]);
  }
}

String _relationshipLabel(int sharedMeetupCount) {
  if (sharedMeetupCount >= 8) return '찐친';
  if (sharedMeetupCount >= 4) return '자주 만나는 친구';
  if (sharedMeetupCount >= 2) return '함께 만나는 사이';
  return '새로운 친구';
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

class _ScheduleChangedNotice extends StatelessWidget {
  const _ScheduleChangedNotice({required this.previous, required this.current});
  final DateTime previous;
  final DateTime current;

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFFFF0E8),
          border: Border.all(color: const Color(0xFFF0C7B5)),
          borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('SCHEDULE CHANGED',
            style: TextStyle(
                color: AimashoColors.coral,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text('집합 시간이 변경되었어요',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(
            '${MeetupScreen._dateFormat.format(previous)}  →  ${MeetupScreen._dateFormat.format(current)}',
            style: const TextStyle(fontSize: 12, color: AimashoColors.muted))
      ]));
}

class _ConfirmedScheduleAvailabilityCard extends ConsumerStatefulWidget {
  const _ConfirmedScheduleAvailabilityCard(
      {required this.meetupId,
      required this.availability,
      required this.changed});
  final String meetupId;
  final VoteStatus? availability;
  final bool changed;

  @override
  ConsumerState<_ConfirmedScheduleAvailabilityCard> createState() =>
      _ConfirmedScheduleAvailabilityCardState();
}

class _ConfirmedScheduleAvailabilityCardState
    extends ConsumerState<_ConfirmedScheduleAvailabilityCard> {
  bool _saving = false;

  Future<void> _update(VoteStatus status) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .updateConfirmedScheduleAvailability(widget.meetupId, status);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('내 참석 가능 여부를 저장하지 못했어요. 다시 시도해 주세요.')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 4, bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFFFFEFB),
          border: Border.all(color: AimashoColors.line),
          borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('MY RESPONSE',
            style: TextStyle(
                color: AimashoColors.coral,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Text(widget.changed ? '변경된 일정에 참여할 수 있나요?' : '이 일정에 참여할 수 있나요?',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        const Text('언제든 내 응답을 다시 선택할 수 있어요.',
            style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
        const SizedBox(height: 12),
        _VoteSelector(
            value: widget.availability, saving: _saving, onSelect: _update)
      ]));
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
    final votesForSlot = widget.detail.votes
        .where((vote) => vote.slotId == widget.slot.id)
        .toList();
    final participantNames = {
      for (final participant in widget.detail.participants)
        participant.uid: participant.displayName
    };
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
        if (votesForSlot.isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: votesForSlot.map((vote) {
                    final color = switch (vote.status) {
                      VoteStatus.yes => AimashoColors.green,
                      VoteStatus.maybe => AimashoColors.yellow,
                      VoteStatus.no => AimashoColors.red
                    };
                    final background = switch (vote.status) {
                      VoteStatus.yes => const Color(0xFFEAF8EF),
                      VoteStatus.maybe => const Color(0xFFFFF6DF),
                      VoteStatus.no => const Color(0xFFFFF0EE)
                    };
                    return Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 5),
                        decoration: BoxDecoration(
                            color: background,
                            borderRadius: BorderRadius.circular(99)),
                        child: Text(
                            '${vote.status.symbol} ${participantNames[vote.participantUid] ?? '알 수 없음'}',
                            style: TextStyle(
                                color: color,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)));
                  }).toList())),
        if (!widget.detail.meetup.isFinished && widget.uid != null)
          Padding(
              padding: const EdgeInsets.only(top: 14),
              child: _VoteSelector(
                  value: myVote?.status, saving: _saving, onSelect: _vote)),
      ]),
    );
  }
}

class _AddCandidateSlotCard extends ConsumerStatefulWidget {
  const _AddCandidateSlotCard({required this.meetupId});
  final String meetupId;
  @override
  ConsumerState<_AddCandidateSlotCard> createState() =>
      _AddCandidateSlotCardState();
}

class _AddCandidateSlotCardState extends ConsumerState<_AddCandidateSlotCard> {
  bool _saving = false;

  Future<void> _add() async {
    final initial = DateTime.now().add(const Duration(days: 1));
    final date = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime.now(),
        lastDate: DateTime.now().add(const Duration(days: 730)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: const TimeOfDay(hour: 19, minute: 0));
    if (time == null || !mounted) return;
    setState(() => _saving = true);
    try {
      await ref.read(meetupRepositoryProvider).addCandidateSlot(widget.meetupId,
          DateTime(date.year, date.month, date.day, time.hour, time.minute));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('날짜 후보를 추가하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: OutlinedButton.icon(
          onPressed: _saving ? null : _add,
          icon: const Icon(Icons.add_rounded),
          label: Text(_saving ? '추가 중...' : '다른 날짜 후보 추가')));
}

class _ContentVotingPanel extends ConsumerStatefulWidget {
  const _ContentVotingPanel(
      {required this.meetupId,
      required this.detail,
      required this.uid,
      required this.isHost});
  final String meetupId;
  final MeetupDetail detail;
  final String? uid;
  final bool isHost;
  @override
  ConsumerState<_ContentVotingPanel> createState() =>
      _ContentVotingPanelState();
}

class _ContentVotingPanelState extends ConsumerState<_ContentVotingPanel> {
  bool _saving = false;

  Future<void> _toggle(ContentOption option, bool selected) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .toggleContentVote(widget.meetupId, option.id, selected);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('선택을 저장하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _addOption(ContentCategory category) async {
    final controller = TextEditingController();
    final label = await showDialog<String>(
        context: context,
        builder: (context) => AlertDialog(
                title: Text('${category.label} 선택지 추가'),
                content: TextField(
                    controller: controller,
                    autofocus: true,
                    maxLength: 60,
                    decoration: const InputDecoration(hintText: '예: 스시')),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('취소')),
                  FilledButton(
                      onPressed: () =>
                          Navigator.pop(context, controller.text.trim()),
                      child: const Text('추가'))
                ]));
    controller.dispose();
    if (label == null || label.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .addContentOption(widget.meetupId, category, label);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('선택지를 추가하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final config = widget.detail.meetup.contentVoteConfig;
    final categories = [
      if (config.food) ContentCategory.food,
      if (config.activity) ContentCategory.activity
    ];
    final names = {
      for (final participant in widget.detail.participants)
        participant.uid: participant.displayName
    };
    return Container(
        margin: const EdgeInsets.only(top: 24),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
            color: const Color(0xFFFFFEFB),
            border: Border.all(color: AimashoColors.line),
            borderRadius: BorderRadius.circular(22)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('WHAT',
              style: TextStyle(
                  color: AimashoColors.coral,
                  fontSize: 11,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          const Text('무엇을 할까요?',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(config.allowMultiple ? '여러 개를 선택할 수 있어요.' : '카테고리마다 하나를 선택해요.',
              style: const TextStyle(color: AimashoColors.muted, fontSize: 12)),
          for (final category in categories) ...[
            const SizedBox(height: 18),
            Row(children: [
              Expanded(
                  child: Text(category.label,
                      style: const TextStyle(fontWeight: FontWeight.w800))),
              if (widget.isHost || config.allowParticipantOptions)
                TextButton.icon(
                    onPressed: _saving ? null : () => _addOption(category),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('선택지'))
            ]),
            ...widget.detail.contentOptions
                .where((option) => option.category == category)
                .map((option) {
              final votes = widget.detail.contentVotes
                  .where((vote) => vote.optionId == option.id)
                  .toList();
              final selected =
                  votes.any((vote) => vote.participantUid == widget.uid);
              return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: selected,
                  onChanged: _saving || widget.detail.meetup.isFinished
                      ? null
                      : (value) => _toggle(option, value ?? false),
                  title: Text(option.label,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: votes.isEmpty
                      ? const Text('아직 선택한 사람이 없어요.')
                      : Text(votes
                          .map((vote) => names[vote.participantUid] ?? '알 수 없음')
                          .join(' · ')),
                  secondary: Text('${votes.length}표',
                      style: const TextStyle(
                          color: AimashoColors.coral,
                          fontWeight: FontWeight.w800)));
            })
          ]
        ]));
  }
}

class _EventPlanPanel extends ConsumerStatefulWidget {
  const _EventPlanPanel(
      {required this.meetupId,
      required this.detail,
      required this.uid,
      required this.canEdit});
  final String meetupId;
  final MeetupDetail detail;
  final String? uid;
  final bool canEdit;
  @override
  ConsumerState<_EventPlanPanel> createState() => _EventPlanPanelState();
}

class _EventPlanPanelState extends ConsumerState<_EventPlanPanel> {
  bool _saving = false;

  Future<void> _edit([PlanItem? existing]) async {
    final title = TextEditingController(text: existing?.title ?? '');
    final note = TextEditingController(text: existing?.note ?? '');
    var type = existing?.type ?? PlanItemType.activity;
    var time = existing?.scheduledAt == null
        ? null
        : TimeOfDay.fromDateTime(existing!.scheduledAt!);
    final submitted = await showDialog<bool>(
        context: context,
        builder: (context) =>
            StatefulBuilder(builder: (context, setDialogState) {
              return AlertDialog(
                  title: Text(existing == null ? '타임라인 추가' : '타임라인 수정'),
                  content: SingleChildScrollView(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                    DropdownButtonFormField<PlanItemType>(
                        value: type,
                        items: PlanItemType.values
                            .map((item) => DropdownMenuItem(
                                value: item,
                                child: Text('${item.emoji} ${item.label}')))
                            .toList(),
                        onChanged: (value) =>
                            setDialogState(() => type = value!)),
                    const SizedBox(height: 10),
                    TextField(
                        controller: title,
                        maxLength: 120,
                        decoration: const InputDecoration(hintText: '할 일 이름')),
                    TextField(
                        controller: note,
                        maxLength: 500,
                        maxLines: 2,
                        decoration: const InputDecoration(hintText: '메모 (선택)')),
                    if (widget.detail.meetup.confirmedDateTime != null)
                      OutlinedButton.icon(
                          onPressed: () async {
                            final picked = await showTimePicker(
                                context: context,
                                initialTime: time ??
                                    TimeOfDay.fromDateTime(widget
                                        .detail.meetup.confirmedDateTime!));
                            if (picked != null) {
                              setDialogState(() => time = picked);
                            }
                          },
                          icon: const Icon(Icons.schedule_rounded),
                          label: Text(time == null
                              ? '시간만 등록 (선택)'
                              : time!.format(context)))
                  ])),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('취소')),
                    FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('저장'))
                  ]);
            }));
    if (submitted != true || title.text.trim().isEmpty) {
      title.dispose();
      note.dispose();
      return;
    }
    DateTime? scheduledAt;
    final date = widget.detail.meetup.confirmedDateTime;
    if (date != null && time != null) {
      scheduledAt =
          DateTime(date.year, date.month, date.day, time!.hour, time!.minute);
    }
    setState(() => _saving = true);
    try {
      final repository = ref.read(meetupRepositoryProvider);
      if (existing == null) {
        await repository.createPlanItem(widget.meetupId,
            type: type,
            title: title.text.trim(),
            scheduledAt: scheduledAt,
            note: note.text.trim());
      } else {
        await repository.updatePlanItem(widget.meetupId, existing.id,
            type: type,
            title: title.text.trim(),
            scheduledAt: scheduledAt,
            place: existing.place,
            note: note.text.trim());
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('타임라인을 저장하지 못했어요: $error')));
      }
    } finally {
      title.dispose();
      note.dispose();
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _status(PlanItem item, PlanItemStatus status) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .setPlanItemStatus(widget.meetupId, item.id, status);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(PlanItem item) async {
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .deletePlanItem(widget.meetupId, item.id);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _move(int index, int offset) async {
    final items = [...widget.detail.planItems];
    final target = index + offset;
    if (target < 0 || target >= items.length) return;
    final item = items.removeAt(index);
    items.insert(target, item);
    setState(() => _saving = true);
    try {
      await ref.read(meetupRepositoryProvider).reorderPlanItems(
          widget.meetupId, items.map((item) => item.id).toList());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: const Color(0xFFFFFEFB),
          border: Border.all(color: AimashoColors.line),
          borderRadius: BorderRadius.circular(22)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('TIMELINE',
            style: TextStyle(
                color: AimashoColors.coral,
                fontSize: 11,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        Row(children: [
          const Expanded(
              child: Text('우리의 하루',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
          if (widget.canEdit && !widget.detail.meetup.isFinished)
            TextButton.icon(
                onPressed: _saving ? null : () => _edit(),
                icon: const Icon(Icons.add, size: 17),
                label: const Text('할 일'))
        ]),
        if (widget.detail.planItems.isEmpty)
          const Padding(
              padding: EdgeInsets.symmetric(vertical: 14),
              child: Text('식사, 활동, 이동 같은 할 일을 시간 순서로 추가해보세요.',
                  style: TextStyle(
                      color: AimashoColors.muted, fontSize: 12, height: 1.5)))
        else
          ...widget.detail.planItems.asMap().entries.map((entry) {
            final item = entry.value;
            final completed = item.status == PlanItemStatus.completed;
            return Container(
                margin: const EdgeInsets.only(top: 10),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: completed
                        ? const Color(0xFFEAF8EF)
                        : const Color(0xFFFFF6EF),
                    borderRadius: BorderRadius.circular(15)),
                child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.type.emoji,
                          style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: 10),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            Text(item.title,
                                style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    decoration: completed
                                        ? TextDecoration.lineThrough
                                        : null)),
                            if (item.scheduledAt != null)
                              Text(
                                  DateFormat('HH:mm').format(item.scheduledAt!),
                                  style: const TextStyle(
                                      color: AimashoColors.coral,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800)),
                            if (item.note?.isNotEmpty == true)
                              Text(item.note!,
                                  style: const TextStyle(
                                      color: AimashoColors.muted, fontSize: 11))
                          ])),
                      PopupMenuButton<String>(
                          enabled: !_saving,
                          onSelected: (action) {
                            if (action == 'done') {
                              _status(
                                  item,
                                  completed
                                      ? PlanItemStatus.planned
                                      : PlanItemStatus.completed);
                            } else if (action == 'edit') {
                              _edit(item);
                            } else if (action == 'delete') {
                              _delete(item);
                            } else if (action == 'up') {
                              _move(entry.key, -1);
                            } else if (action == 'down') {
                              _move(entry.key, 1);
                            }
                          },
                          itemBuilder: (context) => [
                                PopupMenuItem(
                                    value: 'done',
                                    child: Text(completed ? '완료 취소' : '완료 표시')),
                                if (widget.canEdit &&
                                    !widget.detail.meetup.isFinished)
                                  const PopupMenuItem(
                                      value: 'edit', child: Text('수정')),
                                if (widget.canEdit && entry.key > 0)
                                  const PopupMenuItem(
                                      value: 'up', child: Text('위로 이동')),
                                if (widget.canEdit &&
                                    entry.key <
                                        widget.detail.planItems.length - 1)
                                  const PopupMenuItem(
                                      value: 'down', child: Text('아래로 이동')),
                                if (widget.canEdit &&
                                    !widget.detail.meetup.isFinished)
                                  const PopupMenuItem(
                                      value: 'delete', child: Text('삭제'))
                              ])
                    ]));
          })
      ]));
}

class _MeetupManagementPanel extends ConsumerStatefulWidget {
  const _MeetupManagementPanel({required this.meetupId, required this.detail});
  final String meetupId;
  final MeetupDetail detail;
  @override
  ConsumerState<_MeetupManagementPanel> createState() =>
      _MeetupManagementPanelState();
}

class _MeetupManagementPanelState
    extends ConsumerState<_MeetupManagementPanel> {
  bool _busy = false;

  Future<void> _run(String action) async {
    final labels = {
      'complete': '이 약속을 완료하고 기록으로 남길까요?',
      'cancel': '이 약속을 취소할까요?',
      'delete': '이 약속과 모든 투표·정산을 완전히 삭제할까요?'
    };
    final confirmed = await showDialog<bool>(
            context: context,
            builder: (context) =>
                AlertDialog(title: Text(labels[action]!), actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('아니요')),
                  FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('확인'))
                ])) ??
        false;
    if (!confirmed) return;
    setState(() => _busy = true);
    try {
      final repository = ref.read(meetupRepositoryProvider);
      if (action == 'complete') {
        await repository.completeMeetup(widget.meetupId);
      } else if (action == 'cancel') {
        await repository.cancelMeetup(widget.meetupId);
      } else {
        await repository.deleteMeetup(widget.meetupId);
        ref.invalidate(dashboardProvider);
        if (mounted) context.go('/');
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('처리하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 24),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFF0B5A6)),
          borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('약속 관리',
            style: TextStyle(
                color: AimashoColors.coral, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        if (!widget.detail.meetup.isFinished &&
            widget.detail.meetup.isConfirmed)
          OutlinedButton(
              onPressed: _busy ? null : () => _run('complete'),
              child: const Text('약속 완료')),
        if (!widget.detail.meetup.isFinished)
          OutlinedButton(
              onPressed: _busy ? null : () => _run('cancel'),
              child: const Text('약속 취소')),
        TextButton(
            onPressed: _busy ? null : () => _run('delete'),
            child: const Text('약속 삭제'))
      ]));
}

class _ScheduleChangeCard extends ConsumerStatefulWidget {
  const _ScheduleChangeCard(
      {required this.meetupId, required this.confirmedDateTime});
  final String meetupId;
  final DateTime confirmedDateTime;
  @override
  ConsumerState<_ScheduleChangeCard> createState() =>
      _ScheduleChangeCardState();
}

class _ScheduleChangeCardState extends ConsumerState<_ScheduleChangeCard> {
  bool _saving = false;

  Future<void> _change() async {
    final initial = widget.confirmedDateTime.toLocal();
    final date = await showDatePicker(
        context: context,
        initialDate: initial,
        firstDate: DateTime(2020),
        lastDate: DateTime(2100));
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: TimeOfDay.fromDateTime(initial));
    if (time == null || !mounted) return;
    final next =
        DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .updateConfirmedSchedule(widget.meetupId, next);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('집합 날짜와 시간을 변경했어요.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('집합 시간을 변경하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 4, bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFFFF5ED),
          border: Border.all(color: const Color(0xFFE7C1AF)),
          borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('HOST SETTINGS',
            style: TextStyle(
                color: AimashoColors.coral,
                fontSize: 11,
                letterSpacing: 1.1,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 5),
        const Text('집합 날짜·시간 변경',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 5),
        const Text('출발·도착 시간 계산과 출발 알림은 현재 비활성화되어 있어요.',
            style: TextStyle(color: AimashoColors.muted, fontSize: 12)),
        const SizedBox(height: 13),
        OutlinedButton.icon(
            onPressed: _saving ? null : _change,
            icon: const Icon(Icons.edit_calendar_outlined, size: 18),
            label: Text(_saving ? '변경 중...' : '집합 시간 변경'))
      ]));
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
