import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../presentation/meetup_presentation.dart';

enum DashboardMeetupFilter { all, upcoming, finished }

class HomeDashboardView extends StatefulWidget {
  const HomeDashboardView({super.key, required this.data});

  final HomeDashboard data;

  @override
  State<HomeDashboardView> createState() => _HomeDashboardViewState();
}

class _HomeDashboardViewState extends State<HomeDashboardView> {
  bool _calendarMode = true;
  DashboardMeetupFilter _filter = DashboardMeetupFilter.all;
  String _query = '';
  late DateTime _visibleMonth;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    final nextDate = widget.data.meetups
        .where((meetup) => !meetup.isFinished && meetup.displayDate != null)
        .map((meetup) => meetup.displayDate!)
        .where((date) => !date.isBefore(now))
        .fold<DateTime?>(
            null,
            (current, date) =>
                current == null || date.isBefore(current) ? date : current);
    final anchor = nextDate ?? now;
    _visibleMonth = DateTime(anchor.year, anchor.month);
  }

  List<DashboardMeetup> get _filteredMeetups {
    final normalizedQuery = _query.trim().toLowerCase();
    return widget.data.meetups.where((meetup) {
      final matchesFilter = switch (_filter) {
        DashboardMeetupFilter.all => true,
        DashboardMeetupFilter.upcoming => !meetup.isFinished,
        DashboardMeetupFilter.finished => meetup.isFinished,
      };
      final matchesQuery = normalizedQuery.isEmpty ||
          meetup.title.toLowerCase().contains(normalizedQuery) ||
          (meetup.roomName?.toLowerCase().contains(normalizedQuery) ?? false) ||
          (meetup.meetingPlace?.name.toLowerCase().contains(normalizedQuery) ??
              false);
      return matchesFilter && matchesQuery;
    }).toList();
  }

  void _moveMonth(int offset) => setState(() {
        _visibleMonth =
            DateTime(_visibleMonth.year, _visibleMonth.month + offset);
      });

  @override
  Widget build(BuildContext context) {
    final unfinishedOwned = widget.data.meetups
        .where((meetup) => meetup.isOwner && !meetup.isFinished)
        .toList();
    final visibleMeetups = _filteredMeetups;
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 44),
        children: [
          const HomeDashboardHeader(),
          const SizedBox(height: 28),
          const Text('MY AIMASHO', style: eyebrowStyle),
          const SizedBox(height: 5),
          Text('${widget.data.displayName}님의 일정',
              style: Theme.of(context)
                  .textTheme
                  .headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 18),
          GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 2.15,
              children: [
                _Metric('예정', widget.data.summary.upcomingMeetupCount),
                _Metric('함께한 약속', widget.data.summary.completedMeetupCount),
                _Metric('친구', widget.data.summary.friendCount),
                _Metric('그룹', widget.data.summary.groupCount),
              ]),
          const SizedBox(height: 12),
          OutlinedButton.icon(
              onPressed: () => context.push('/journey'),
              icon: const Icon(Icons.route_rounded),
              label: const Text('나의 Journey 재생')),
          const SizedBox(height: 8),
          ElevatedButton.icon(
              onPressed: () => context.push('/new'),
              icon: const Icon(Icons.add_rounded),
              label: const Text('새 약속 만들기')),
          const SizedBox(height: 30),
          _SectionHeader(
              eyebrow: 'IN PROGRESS',
              title: '내가 만든 일정',
              trailing: '${unfinishedOwned.length}개'),
          if (unfinishedOwned.isEmpty)
            const _Empty('진행 중인 내 일정이 없어요.')
          else
            ...unfinishedOwned.take(6).map(_MeetupTile.new),
          const SizedBox(height: 28),
          Row(children: [
            const Expanded(
                child: _SectionHeader(eyebrow: 'SCHEDULE', title: '모든 일정')),
            SegmentedButton<bool>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(
                      value: false,
                      icon: Icon(Icons.view_timeline_outlined, size: 17)),
                  ButtonSegment(
                      value: true,
                      icon: Icon(Icons.calendar_month_outlined, size: 17))
                ],
                selected: {_calendarMode},
                onSelectionChanged: (value) =>
                    setState(() => _calendarMode = value.first))
          ]),
          const SizedBox(height: 12),
          TextField(
              onChanged: (value) => setState(() => _query = value),
              decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: '일정·그룹·장소 검색',
                  isDense: true)),
          const SizedBox(height: 10),
          SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<DashboardMeetupFilter>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(
                        value: DashboardMeetupFilter.all, label: Text('전체')),
                    ButtonSegment(
                        value: DashboardMeetupFilter.upcoming,
                        label: Text('예정·조율')),
                    ButtonSegment(
                        value: DashboardMeetupFilter.finished,
                        label: Text('완료·취소')),
                  ],
                  selected: {_filter},
                  onSelectionChanged: (value) =>
                      setState(() => _filter = value.first))),
          const SizedBox(height: 12),
          if (visibleMeetups.isEmpty)
            const _Empty('조건에 맞는 일정이 없어요.')
          else if (_calendarMode)
            _CalendarPanel(
                meetups: visibleMeetups,
                visibleMonth: _visibleMonth,
                onPrevious: () => _moveMonth(-1),
                onNext: () => _moveMonth(1))
          else
            ...visibleMeetups.map(_MeetupTile.new),
          const SizedBox(height: 30),
          const _SectionHeader(eyebrow: 'TOGETHER', title: '친구'),
          if (widget.data.relationships.isEmpty)
            const _Empty('함께 약속을 완료하면 친구 기록이 쌓여요.')
          else
            ...widget.data.relationships.take(5).map((relationship) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                    backgroundColor: const Color(0xFFFFE5D6),
                    child: Text(displayInitial(relationship.displayName))),
                title: Text(relationship.displayName,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('함께한 약속 ${relationship.sharedMeetupCount}회'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () =>
                    context.push('/friends/${relationship.otherUid}'))),
          const SizedBox(height: 24),
          const _SectionHeader(eyebrow: 'GROUPS', title: '내 그룹'),
          if (widget.data.rooms.isEmpty)
            const _Empty('프로필에서 그룹을 만들거나 초대 코드를 입력해보세요.')
          else
            ...widget.data.rooms.map((room) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const CircleAvatar(
                    backgroundColor: Color(0xFFFFE5D6), child: Text('👥')),
                title: Text(room.name,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('함께한 약속 ${room.completedMeetupCount}회'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () => context.push('/rooms/${room.id}')))
        ]);
  }
}

class _CalendarPanel extends StatelessWidget {
  const _CalendarPanel(
      {required this.meetups,
      required this.visibleMonth,
      required this.onPrevious,
      required this.onNext});

  final List<DashboardMeetup> meetups;
  final DateTime visibleMonth;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final first = DateTime(visibleMonth.year, visibleMonth.month, 1);
    final days = DateTime(visibleMonth.year, visibleMonth.month + 1, 0).day;
    final leading = first.weekday % 7;
    return Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
            color: const Color(0xFFFFFEFB),
            border: Border.all(color: AimashoColors.line),
            borderRadius: BorderRadius.circular(20)),
        child: Column(children: [
          Row(children: [
            IconButton(
                tooltip: '이전 달',
                onPressed: onPrevious,
                icon: const Icon(Icons.chevron_left_rounded)),
            Expanded(
                child: Text(DateFormat('yyyy년 M월', 'ko').format(visibleMonth),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w800))),
            IconButton(
                tooltip: '다음 달',
                onPressed: onNext,
                icon: const Icon(Icons.chevron_right_rounded))
          ]),
          const Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _Weekday('일'),
                _Weekday('월'),
                _Weekday('화'),
                _Weekday('수'),
                _Weekday('목'),
                _Weekday('금'),
                _Weekday('토')
              ]),
          GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 7, childAspectRatio: 1),
              itemCount: leading + days,
              itemBuilder: (context, index) {
                if (index < leading) return const SizedBox.shrink();
                final day = index - leading + 1;
                final items = meetups.where((meetup) {
                  final date = meetup.displayDate;
                  return date != null &&
                      date.year == visibleMonth.year &&
                      date.month == visibleMonth.month &&
                      date.day == day;
                }).toList();
                return InkWell(
                    borderRadius: BorderRadius.circular(10),
                    onTap: items.isEmpty
                        ? null
                        : () => context.push('/m/${items.first.id}/plan'),
                    child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('$day', style: const TextStyle(fontSize: 11)),
                          if (items.isNotEmpty)
                            Container(
                                width: 6,
                                height: 6,
                                margin: const EdgeInsets.only(top: 3),
                                decoration: BoxDecoration(
                                    color:
                                        items.every((item) => item.isFinished)
                                            ? AimashoColors.muted
                                            : AimashoColors.coral,
                                    shape: BoxShape.circle))
                        ]));
              })
        ]));
  }
}

class _Weekday extends StatelessWidget {
  const _Weekday(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => SizedBox(
      width: 30,
      child: Text(label,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 10, color: AimashoColors.muted)));
}

class _MeetupTile extends StatelessWidget {
  const _MeetupTile(this.meetup);
  final DashboardMeetup meetup;

  @override
  Widget build(BuildContext context) {
    final date = meetup.displayDate;
    return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: meetup.isFinished
                    ? const Color(0xFFF1ECE8)
                    : const Color(0xFFFFE5D6),
                borderRadius: BorderRadius.circular(14)),
            child: date == null
                ? const Icon(Icons.more_horiz_rounded,
                    color: AimashoColors.coral)
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                        Text('${date.month}/${date.day}',
                            style: const TextStyle(
                                fontSize: 11, fontWeight: FontWeight.w800)),
                        Text(DateFormat('HH:mm').format(date),
                            style: const TextStyle(fontSize: 9))
                      ])),
        title: Text(meetup.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text([
          meetupStatusLabel(meetup.status),
          if (meetup.roomName != null) meetup.roomName!,
          if (meetup.meetingPlace != null) meetup.meetingPlace!.name,
        ].join(' · ')),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => context.push('/m/${meetup.id}/plan'));
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value);
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 12),
      decoration: BoxDecoration(
          color: const Color(0xFFFFF0E8),
          borderRadius: BorderRadius.circular(17)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$value',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
        Text(label,
            style: const TextStyle(fontSize: 11, color: AimashoColors.muted))
      ]));
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(
      {required this.eyebrow, required this.title, this.trailing});
  final String eyebrow;
  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(eyebrow, style: eyebrowStyle),
        const SizedBox(height: 4),
        Row(children: [
          Expanded(
              child: Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w800))),
          if (trailing != null)
            Text(trailing!,
                style:
                    const TextStyle(fontSize: 12, color: AimashoColors.muted))
        ])
      ]);
}

class _Empty extends StatelessWidget {
  const _Empty(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(text,
          style: const TextStyle(color: AimashoColors.muted, fontSize: 12)));
}

class HomeDashboardHeader extends StatelessWidget {
  const HomeDashboardHeader({super.key});

  @override
  Widget build(BuildContext context) => Row(children: [
        const AimashoWordmark(),
        const Spacer(),
        TextButton(
            onPressed: () => context.push('/new'), child: const Text('새 약속')),
        IconButton(
            tooltip: '마이페이지',
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.account_circle_outlined))
      ]);
}

class AimashoWordmark extends StatelessWidget {
  const AimashoWordmark({super.key});

  @override
  Widget build(BuildContext context) => const Row(children: [
        DecoratedBox(
            decoration: BoxDecoration(
                color: AimashoColors.coral,
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(10),
                    topRight: Radius.circular(10),
                    bottomRight: Radius.circular(10),
                    bottomLeft: Radius.circular(3))),
            child: SizedBox(
                width: 30,
                height: 30,
                child: Center(
                    child: Text('a',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            fontStyle: FontStyle.italic))))),
        SizedBox(width: 8),
        Text('aimasho',
            style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800))
      ]);
}

const eyebrowStyle = TextStyle(
    fontSize: 11,
    color: AimashoColors.coral,
    letterSpacing: 1.2,
    fontWeight: FontWeight.w800);
