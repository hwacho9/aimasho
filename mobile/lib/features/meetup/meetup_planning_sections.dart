part of 'meetup_screen.dart';

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
    Location? place = existing?.place;
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
                    PlaceSearch(
                        hint: '플랜 장소 검색 (선택)',
                        onPick: (value) => setDialogState(() => place = value)),
                    if (place != null)
                      ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.place_outlined),
                          title: Text(place!.name),
                          subtitle: place!.address == null
                              ? null
                              : Text(place!.address!),
                          trailing: IconButton(
                              tooltip: '선택한 장소 지우기',
                              onPressed: () => setDialogState(() => place = null),
                              icon: const Icon(Icons.close))),
                    const SizedBox(height: 10),
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
            place: place,
            note: note.text.trim());
      } else {
        await repository.updatePlanItem(widget.meetupId, existing.id,
            type: type,
            title: title.text.trim(),
            scheduledAt: scheduledAt,
            place: place,
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
                                      color: AimashoColors.muted, fontSize: 11)),
                            if (item.place != null)
                              Text('📍 ${item.place!.name}',
                                  style: const TextStyle(
                                      color: AimashoColors.muted, fontSize: 12))
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
