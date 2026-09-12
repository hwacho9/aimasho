// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class MeetupLifecycle extends ConsumerWidget {
  const MeetupLifecycle(
      {super.key,
      required this.meetupId,
      required this.detail,
      required this.currentUid,
      required this.isHost});
  final String meetupId;
  final MeetupDetail detail;
  final String? currentUid;
  final bool isHost;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!detail.meetup.isConfirmed) return const SizedBox.shrink();
    return Column(children: [
      if (detail.meetup.collectOrigins && !detail.meetup.isFinished)
        OriginPanel(
            meetupId: meetupId,
            detail: detail,
            currentUid: currentUid,
            isHost: isHost),
      if (!detail.meetup.isFinished)
        LocationPanel(meetupId: meetupId, detail: detail, isHost: isHost),
      if (detail.meetup.meetingPlace != null)
        MeetingPlaceReadyPanel(detail: detail),
      const SizedBox(height: 18),
      ExpensesPanel(meetupId: meetupId, detail: detail, currentUid: currentUid)
    ]);
  }
}

class Panel extends StatelessWidget {
  const Panel(
      {super.key,
      required this.eyebrow,
      required this.title,
      required this.child});
  final String eyebrow;
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 25),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: const Color(0xFFFFFEFB),
          border: Border.all(color: AimashoColors.line),
          borderRadius: BorderRadius.circular(22)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(eyebrow,
            style: const TextStyle(
                fontSize: 11,
                color: AimashoColors.coral,
                letterSpacing: 1.2,
                fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(title,
            style: Theme.of(context)
                .textTheme
                .titleLarge
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        child
      ]));
}

class PlaceSearch extends ConsumerStatefulWidget {
  const PlaceSearch(
      {super.key, required this.onPick, this.hint = '역 / 장소 / 주소 검색'});
  final ValueChanged<Location> onPick;
  final String hint;
  @override
  ConsumerState<PlaceSearch> createState() => _PlaceSearchState();
}

class _PlaceSearchState extends ConsumerState<PlaceSearch> {
  final _query = TextEditingController();
  List<Location> _results = [];
  bool _loading = false;
  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    if (_query.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      _results = await ref
          .read(meetupRepositoryProvider)
          .searchPlaces(_query.text.trim());
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('검색하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(children: [
        Row(children: [
          Expanded(
              child: TextField(
                  controller: _query,
                  onSubmitted: (_) => _search(),
                  decoration:
                      InputDecoration(hintText: widget.hint, isDense: true))),
          const SizedBox(width: 7),
          FilledButton(
              onPressed: _loading ? null : _search,
              style: FilledButton.styleFrom(
                  minimumSize: const Size(60, 46),
                  backgroundColor: AimashoColors.ink),
              child: Text(_loading ? '...' : '검색'))
        ]),
        if (_results.isNotEmpty)
          Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                  border: Border.all(color: AimashoColors.line),
                  borderRadius: BorderRadius.circular(12)),
              child: Column(
                  children: _results
                      .map((place) => ListTile(
                          dense: true,
                          title: Text(place.name,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: place.address == null
                              ? null
                              : Text(place.address!,
                                  style: const TextStyle(fontSize: 10)),
                          onTap: () {
                            setState(() => _results = []);
                            widget.onPick(place);
                          }))
                      .toList()))
      ]);
}

class OriginPanel extends ConsumerStatefulWidget {
  const OriginPanel(
      {super.key,
      required this.meetupId,
      required this.detail,
      required this.currentUid,
      required this.isHost});
  final String meetupId;
  final MeetupDetail detail;
  final String? currentUid;
  final bool isHost;
  @override
  ConsumerState<OriginPanel> createState() => _OriginPanelState();
}

class _OriginPanelState extends ConsumerState<OriginPanel> {
  bool _loading = false;
  Future<void> _save(Location location) async {
    setState(() => _loading = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .saveOrigin(widget.meetupId, location);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('출발 위치를 저장하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _continue() async {
    setState(() => _loading = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .beginLocationSelection(widget.meetupId);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('계속할 수 없어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mine = widget.detail.participants
        .where((item) => item.uid == widget.currentUid)
        .cast<Participant?>()
        .firstWhere((item) => item != null, orElse: () => null);
    final count =
        widget.detail.participants.where((item) => item.hasOrigin).length;
    return Panel(
        eyebrow: 'STEP 1 · ORIGIN',
        title: '어디서 출발하나요?',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('정확한 좌표는 공개되지 않지만, 경로 안내에는 선택한 출발지 이름이 참가자에게 표시돼요.',
              style: TextStyle(
                  color: AimashoColors.muted, fontSize: 12, height: 1.6)),
          const SizedBox(height: 14),
          mine?.hasOrigin == true
              ? Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                      color: const Color(0xFFEAF8EF),
                      borderRadius: BorderRadius.circular(12)),
                  child: Text('✓ ${mine?.originArea ?? '출발 위치'}에서 출발해요',
                      style: const TextStyle(
                          color: Color(0xFF397D58),
                          fontWeight: FontWeight.w700)))
              : PlaceSearch(onPick: _loading ? (_) {} : _save),
          const SizedBox(height: 15),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('출발 위치 등록', style: TextStyle(fontSize: 12)),
            Text('$count/${widget.detail.participants.length}명',
                style: const TextStyle(fontWeight: FontWeight.w800))
          ]),
          const SizedBox(height: 8),
          Wrap(
              spacing: 6,
              runSpacing: 6,
              children: widget.detail.participants
                  .map((item) => Chip(
                      label: Text(
                          '${item.hasOrigin ? '✓' : '○'} ${item.displayName}',
                          style: TextStyle(
                              fontSize: 11,
                              color: item.hasOrigin
                                  ? const Color(0xFF397D58)
                                  : AimashoColors.muted)),
                      backgroundColor: item.hasOrigin
                          ? const Color(0xFFEAF8EF)
                          : const Color(0xFFF5EEE8),
                      side: BorderSide.none))
                  .toList()),
          if (widget.isHost && count >= 2)
            Padding(
                padding: const EdgeInsets.only(top: 17),
                child: ElevatedButton(
                    onPressed: _loading ? null : _continue,
                    child: const Text('장소 추천으로 계속')))
        ]));
  }
}

class LocationPanel extends ConsumerStatefulWidget {
  const LocationPanel(
      {super.key,
      required this.meetupId,
      required this.detail,
      required this.isHost});
  final String meetupId;
  final MeetupDetail detail;
  final bool isHost;
  @override
  ConsumerState<LocationPanel> createState() => _LocationPanelState();
}

class _LocationPanelState extends ConsumerState<LocationPanel> {
  String _mode = 'FAIR';
  bool _loading = false;
  List<MeetingPointCandidate> _candidates = [];
  Future<void> _recommend(String mode) async {
    setState(() {
      _mode = mode;
      _loading = true;
    });
    try {
      _candidates = await ref
          .read(meetupRepositoryProvider)
          .meetingPointRecommendations(widget.meetupId, mode);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('중간지점 이동 시간을 계산하지 못했어요. 잠시 후 다시 시도해 주세요.')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _choose(Location location) async {
    setState(() => _loading = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .confirmMeetingPlace(widget.meetupId, location);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('장소를 확정하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final originCount =
        widget.detail.participants.where((item) => item.hasOrigin).length;
    final canRecommend = originCount >= 2;
    return Panel(
        eyebrow: 'STEP 2 · PLACE',
        title: '어디서 만날까요?',
        child: !widget.isHost
            ? const Text('호스트가 만날 장소를 고르고 있어요.',
                style: TextStyle(color: AimashoColors.muted))
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(value: 'FAIR', label: Text('⚖️ 공평하게')),
                      ButtonSegment(value: 'FAST', label: Text('⚡ 빠르게'))
                    ],
                    selected: {
                      _mode
                    },
                    onSelectionChanged:
                        _loading ? null : (value) => _recommend(value.first)),
                const SizedBox(height: 12),
                OutlinedButton(
                    onPressed: _loading || !canRecommend
                        ? null
                        : () => _recommend(_mode),
                    child: Text(_loading ? '추천 계산 중...' : '✨ 중간지점 추천')),
                if (!canRecommend)
                  Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                          '중간지점 추천은 출발지 2개 이상이 등록되면 사용할 수 있어요. ($originCount개)',
                          style: const TextStyle(
                              color: AimashoColors.muted, fontSize: 11))),
                const SizedBox(height: 14),
                const Text('또는 직접 장소 정하기',
                    style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
                const SizedBox(height: 7),
                PlaceSearch(hint: '장소 검색', onPick: _choose),
                ..._candidates.asMap().entries.map((entry) {
                  final place = entry.value;
                  return Container(
                      margin: const EdgeInsets.only(top: 10),
                      padding: const EdgeInsets.all(13),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFFF5ED),
                          borderRadius: BorderRadius.circular(15)),
                      child: Row(children: [
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(
                                  entry.key == 0
                                      ? '🥇 AIMASHO PICK'
                                      : '후보 ${entry.key + 1}',
                                  style: const TextStyle(
                                      fontSize: 10,
                                      color: AimashoColors.coral,
                                      fontWeight: FontWeight.w800)),
                              Text(place.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                              Text(
                                  '평균 ${place.averageDurationMinutes}분 · 최장 ${place.maxDurationMinutes}분',
                                  style: const TextStyle(
                                      fontSize: 11, color: AimashoColors.muted))
                            ])),
                        FilledButton(
                            onPressed: _loading ? null : () => _choose(place),
                            child: const Text('여기서'))
                      ]));
                })
              ]));
  }
}

class MeetingPlaceReadyPanel extends StatelessWidget {
  const MeetingPlaceReadyPanel({super.key, required this.detail});
  final MeetupDetail detail;
  @override
  Widget build(BuildContext context) => Panel(
      eyebrow: 'MEETING PLACE',
      title: '${detail.meetup.meetingPlace?.name ?? '약속 장소'}에서 만나요',
      child: const Text(
          '출발·도착 시간 계산과 출발 알림은 현재 비활성화되어 있어요. 실제 이동 경로와 시간은 지도 앱에서 확인해 주세요.',
          style: TextStyle(color: AimashoColors.muted)));
}

class ExpensesPanel extends ConsumerStatefulWidget {
  const ExpensesPanel(
      {super.key,
      required this.meetupId,
      required this.detail,
      required this.currentUid});
  final String meetupId;
  final MeetupDetail detail;
  final String? currentUid;
  @override
  ConsumerState<ExpensesPanel> createState() => _ExpensesPanelState();
}

class _ExpensesPanelState extends ConsumerState<ExpensesPanel> {
  final _title = TextEditingController();
  final _amount = TextEditingController();
  late String _paidBy;
  late Set<String> _sharers;
  bool _saving = false;
  Settlement? _settlement;
  Expense? _editing;

  @override
  void initState() {
    super.initState();
    _paidBy = widget.currentUid ?? widget.detail.participants.first.uid;
    _sharers = widget.detail.participants.map((item) => item.uid).toSet();
  }

  @override
  void dispose() {
    _title.dispose();
    _amount.dispose();
    super.dispose();
  }

  void _resetForm() {
    _editing = null;
    _title.clear();
    _amount.clear();
    _paidBy = widget.currentUid ?? widget.detail.participants.first.uid;
    _sharers = widget.detail.participants.map((item) => item.uid).toSet();
  }

  void _startEditing(Expense expense) {
    setState(() {
      _editing = expense;
      _title.text = expense.title;
      _amount.text = expense.amount.toString();
      _paidBy = expense.paidByUid;
      _sharers = expense.participantUids.toSet();
    });
  }

  Future<void> _save() async {
    final amount = int.tryParse(_amount.text);
    if (_title.text.trim().isEmpty ||
        amount == null ||
        amount <= 0 ||
        _sharers.isEmpty) return;
    setState(() => _saving = true);
    try {
      if (_editing == null) {
        await ref.read(meetupRepositoryProvider).createExpense(widget.meetupId,
            title: _title.text.trim(),
            amount: amount,
            paidByUid: _paidBy,
            participantUids: _sharers.toList());
      } else {
        await ref.read(meetupRepositoryProvider).updateExpense(
            widget.meetupId, _editing!.id,
            title: _title.text.trim(),
            amount: amount,
            paidByUid: _paidBy,
            participantUids: _sharers.toList());
      }
      if (mounted) setState(_resetForm);
      await _showResult();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('비용을 저장하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(Expense expense) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('지출을 삭제할까요?'),
            content: Text('‘${expense.title}’ 항목이 삭제됩니다.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('취소')),
              TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('삭제')),
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .deleteExpense(widget.meetupId, expense.id);
      if (mounted && _editing?.id == expense.id) setState(_resetForm);
      await _showResult();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('비용을 삭제하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _showResult() async {
    try {
      final value =
          await ref.read(meetupRepositoryProvider).settlement(widget.meetupId);
      if (mounted) setState(() => _settlement = value);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('정산을 계산하지 못했어요: $error')));
    }
  }

  String _yen(int value) =>
      '¥${value.toString().replaceAllMapped(RegExp(r'(?=(\d{3})+(?!\d))'), (_) => ',')}';

  @override
  Widget build(BuildContext context) {
    final names = {
      for (final person in widget.detail.participants)
        person.uid: person.displayName
    };
    return Panel(
        eyebrow: 'SPLIT THE BILL',
        title: '정산하기',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(
              controller: _title,
              decoration:
                  const InputDecoration(hintText: '항목 · 예: 저녁', isDense: true)),
          const SizedBox(height: 8),
          TextField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(hintText: '금액 (¥)', isDense: true)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
              value: _paidBy,
              items: widget.detail.participants
                  .map((item) => DropdownMenuItem(
                      value: item.uid, child: Text('${item.displayName} 결제')))
                  .toList(),
              onChanged: (value) => setState(() => _paidBy = value!)),
          const SizedBox(height: 7),
          Wrap(
              spacing: 6,
              children: widget.detail.participants
                  .map((item) => FilterChip(
                      label: Text(item.displayName),
                      selected: _sharers.contains(item.uid),
                      onSelected: (selected) => setState(() {
                            if (selected) {
                              _sharers.add(item.uid);
                            } else {
                              _sharers.remove(item.uid);
                            }
                          })))
                  .toList()),
          const SizedBox(height: 12),
          if (_editing != null) ...[
            Text('‘${_editing!.title}’ 수정 중',
                style: const TextStyle(
                    color: AimashoColors.coral, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
          ],
          OutlinedButton(
              onPressed: _saving ? null : _save,
              child: Text(_saving
                  ? '저장 중...'
                  : _editing == null
                      ? '비용 추가'
                      : '지출 수정 저장')),
          if (_editing != null)
            TextButton(
                onPressed: _saving ? null : () => setState(_resetForm),
                child: const Text('수정 취소')),
          if (widget.detail.expenses.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...widget.detail.expenses.map((expense) {
              final canManage = expense.createdByUid == widget.currentUid;
              return ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(expense.title),
                  subtitle: Text(
                      '${names[expense.paidByUid]} 결제 · ${expense.participantUids.length}명'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(_yen(expense.amount),
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    if (canManage)
                      PopupMenuButton<String>(
                          enabled: !_saving,
                          onSelected: (action) {
                            if (action == 'edit') _startEditing(expense);
                            if (action == 'delete') _delete(expense);
                          },
                          itemBuilder: (context) => const [
                                PopupMenuItem(value: 'edit', child: Text('수정')),
                                PopupMenuItem(
                                    value: 'delete', child: Text('삭제')),
                              ]),
                  ]));
            }),
            ElevatedButton(
                onPressed: _showResult, child: const Text('정산 결과 보기')),
          ],
          if (_settlement != null)
            Container(
                margin: const EdgeInsets.only(top: 13),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                    color: const Color(0xFFFFF0E8),
                    borderRadius: BorderRadius.circular(14)),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('총 ${_yen(_settlement!.totalAmount)}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      ..._settlement!.transfers.map((transfer) => Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                              '${names[transfer.fromUid]} → ${names[transfer.toUid]}   ${_yen(transfer.amount)}')))
                    ])),
        ]));
  }
}
