part of 'meetup_screen.dart';

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

class _ResponseDeadlineNotice extends StatelessWidget {
  const _ResponseDeadlineNotice({required this.deadline, required this.passed});
  final DateTime deadline;
  final bool passed;

  @override
  Widget build(BuildContext context) => Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
      decoration: BoxDecoration(
          color: passed ? const Color(0xFFF2EEEB) : const Color(0xFFFFF6DF),
          borderRadius: BorderRadius.circular(15)),
      child: Row(children: [
        Icon(passed ? Icons.lock_clock_outlined : Icons.schedule_rounded,
            size: 19,
            color: passed ? AimashoColors.muted : AimashoColors.coral),
        const SizedBox(width: 9),
        Expanded(
            child: Text(
                passed
                    ? '응답이 마감되었어요 · ${MeetupScreen._dateFormat.format(deadline)}'
                    : '응답 마감 · ${MeetupScreen._dateFormat.format(deadline)}',
                style: TextStyle(
                    color: passed ? AimashoColors.muted : AimashoColors.ink,
                    fontSize: 12,
                    fontWeight: FontWeight.w700)))
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
        if (widget.detail.meetup.canEditScheduleAt(DateTime.now()) &&
            widget.uid != null)
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

class _MeetupReminderCard extends ConsumerStatefulWidget {
  const _MeetupReminderCard({required this.meetupId, required this.enabled});
  final String meetupId;
  final bool enabled;

  @override
  ConsumerState<_MeetupReminderCard> createState() =>
      _MeetupReminderCardState();
}

class _MeetupReminderCardState extends ConsumerState<_MeetupReminderCard> {
  bool _saving = false;

  Future<void> _setEnabled(bool enabled) async {
    setState(() => _saving = true);
    try {
      await ref.read(meetupRepositoryProvider).setMeetupReminders(
          widget.meetupId,
          enabled: enabled,
          locale: Localizations.localeOf(context).languageCode);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                enabled ? '일정 전날, 1시간 전, 10분 전에 알려드릴게요.' : '이 일정의 알림을 껐어요.')));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('알림 설정을 바꾸지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 4, bottom: 12),
      decoration: BoxDecoration(
          color: widget.enabled
              ? const Color(0xFFF1FAF4)
              : const Color(0xFFFFFBF7),
          border: Border.all(
              color: widget.enabled
                  ? const Color(0xFFB8DFC4)
                  : AimashoColors.line),
          borderRadius: BorderRadius.circular(18)),
      child: SwitchListTile.adaptive(
          value: widget.enabled,
          onChanged: _saving ? null : _setEnabled,
          secondary: Icon(
              widget.enabled
                  ? Icons.notifications_active_rounded
                  : Icons.notifications_none_rounded,
              color:
                  widget.enabled ? AimashoColors.green : AimashoColors.coral),
          title: Text(_saving ? '알림 설정 중...' : '일정 알림',
              style: const TextStyle(fontWeight: FontWeight.w800)),
          subtitle: const Text('약속 전날, 1시간 전, 10분 전에 푸시 알림을 보내드려요.',
              style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 15, vertical: 5)));
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
