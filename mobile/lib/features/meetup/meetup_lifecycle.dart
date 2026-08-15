// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

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
    switch (detail.meetup.status) {
      case 'SCHEDULE_CONFIRMED':
      case 'LOCATION_COLLECTING':
        return OriginPanel(
            meetupId: meetupId,
            detail: detail,
            currentUid: currentUid,
            isHost: isHost);
      case 'LOCATION_SELECTING':
        return LocationPanel(meetupId: meetupId, isHost: isHost);
      case 'LOCATION_CONFIRMED':
        return RoutesPanel(
            meetupId: meetupId,
            detail: detail,
            currentUid: currentUid,
            isHost: isHost);
      case 'READY':
        return Column(children: [
          RoutesPanel(
              meetupId: meetupId,
              detail: detail,
              currentUid: currentUid,
              isHost: isHost),
          const SizedBox(height: 18),
          ExpensesPanel(
              meetupId: meetupId, detail: detail, currentUid: currentUid)
        ]);
      default:
        return const SizedBox.shrink();
    }
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
          const Text('정확한 위치는 다른 참가자에게 보이지 않으며, 장소와 경로 계산에만 사용돼요.',
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
      {super.key, required this.meetupId, required this.isHost});
  final String meetupId;
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
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('추천을 찾지 못했어요: $error')));
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
  Widget build(BuildContext context) => Panel(
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
                  onPressed: _loading ? null : () => _recommend(_mode),
                  child: Text(_loading ? '추천 계산 중...' : '✨ 중간지점 추천')),
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

class RoutesPanel extends ConsumerStatefulWidget {
  const RoutesPanel(
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
  ConsumerState<RoutesPanel> createState() => _RoutesPanelState();
}

class _RoutesPanelState extends ConsumerState<RoutesPanel> {
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _registerDepartureNotifications();
  }

  @override
  void didUpdateWidget(covariant RoutesPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.detail.routes.isEmpty && widget.detail.routes.isNotEmpty) {
      _registerDepartureNotifications();
    }
  }

  Future<void> _registerDepartureNotifications() async {
    try {
      await ref
          .read(meetupRepositoryProvider)
          .registerDepartureNotifications(widget.meetupId);
    } catch (_) {
      // Notification setup must never block reviewing the route.
    }
  }

  Future<void> _calculate() async {
    setState(() => _loading = true);
    try {
      await ref.read(meetupRepositoryProvider).calculateRoutes(widget.meetupId);
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('경로를 계산하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _clock(DateTime? date) =>
      date == null ? '—' : TimeOfDay.fromDateTime(date).format(context);
  @override
  Widget build(BuildContext context) {
    if (widget.detail.routes.isEmpty)
      return Panel(
          eyebrow: 'STEP 3 · ROUTES',
          title: '각자의 출발 시간을 계산할게요',
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(
                '${widget.detail.meetup.meetingPlace?.name ?? ''}에 약속 10분 전 도착하도록 맞춰드려요.',
                style: const TextStyle(color: AimashoColors.muted)),
            const SizedBox(height: 14),
            if (widget.isHost)
              ElevatedButton(
                  onPressed: _loading ? null : _calculate,
                  child: Text(_loading ? '경로 계산 중...' : '🚃 출발 시간 계산'))
            else
              const Text('호스트가 경로를 계산하면 여기에서 확인할 수 있어요.',
                  style: TextStyle(fontSize: 12, color: AimashoColors.muted))
          ]));
    final mine = widget.detail.routes
        .where((item) => item.participantUid == widget.currentUid)
        .cast<ParticipantRoute?>()
        .firstWhere((item) => item != null, orElse: () => null);
    return Panel(
        eyebrow: 'READY TO GO',
        title: '${widget.detail.meetup.meetingPlace?.name ?? '약속 장소'}에서 만나요',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('목표 도착  ${_clock(widget.detail.meetup.targetArrivalTime)}',
              style: const TextStyle(color: AimashoColors.muted)),
          if (mine != null)
            Container(
                margin: const EdgeInsets.only(top: 13),
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                    color: const Color(0xFFFFF1E5),
                    borderRadius: BorderRadius.circular(15)),
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('🚃 ${_clock(mine.departureTime)}에 출발하세요',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 5),
                      Text(mine.routeSummary),
                      Text(
                          '약 ${mine.durationMinutes}분 · ${_clock(mine.arrivalTime)} 도착 예정',
                          style: const TextStyle(
                              fontSize: 12, color: AimashoColors.muted)),
                      const Text(
                          'Google Maps는 현재 시각 기준으로 표시될 수 있어요. 출발 시각은 위 안내를 기준으로 확인해주세요.',
                          style: TextStyle(
                              fontSize: 11, color: AimashoColors.muted)),
                      const Text('알림 권한을 허용하면 출발 시간에 알려드려요.',
                          style: TextStyle(
                              fontSize: 11, color: AimashoColors.muted)),
                      TextButton(
                          onPressed: () => launchUrl(
                              Uri.parse(mine.externalMapsUrl),
                              mode: LaunchMode.externalApplication),
                          child: const Text('Google Maps에서 경로 다시 확인 ↗'))
                    ])),
          const SizedBox(height: 10),
          ...widget.detail.routes.map((route) {
            final person = widget.detail.participants
                .where((item) => item.uid == route.participantUid)
                .cast<Participant?>()
                .firstWhere((item) => item != null, orElse: () => null);
            return Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  Expanded(child: Text(person?.displayName ?? '참가자')),
                  Text(_clock(route.departureTime),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(width: 9),
                  Text('${route.durationMinutes}분',
                      style: const TextStyle(color: AimashoColors.muted)),
                  const SizedBox(width: 9),
                  Text(_clock(route.arrivalTime),
                      style: const TextStyle(fontWeight: FontWeight.w800))
                ]));
          })
        ]));
  }
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

  Future<void> _add() async {
    final amount = int.tryParse(_amount.text);
    if (_title.text.trim().isEmpty ||
        amount == null ||
        amount <= 0 ||
        _sharers.isEmpty) return;
    setState(() => _saving = true);
    try {
      await ref.read(meetupRepositoryProvider).createExpense(widget.meetupId,
          title: _title.text.trim(),
          amount: amount,
          paidByUid: _paidBy,
          participantUids: _sharers.toList());
      _title.clear();
      _amount.clear();
      await _showResult();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('비용을 등록하지 못했어요: $error')));
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
          OutlinedButton(
              onPressed: _saving ? null : _add,
              child: Text(_saving ? '등록 중...' : '비용 추가')),
          if (widget.detail.expenses.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...widget.detail.expenses.map((expense) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(expense.title),
                  subtitle: Text(
                      '${names[expense.paidByUid]} 결제 · ${expense.participantUids.length}명'),
                  trailing: Text(_yen(expense.amount),
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                )),
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
