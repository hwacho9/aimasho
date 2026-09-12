part of 'meetup_screen.dart';

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
        if (mounted) context.go('/');
      }
      ref.invalidate(dashboardProvider);
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
