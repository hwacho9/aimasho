import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _signingIn = false;
  bool _calendarMode = false;

  Future<void> _signIn() async {
    setState(() => _signingIn = true);
    try {
      final repository = ref.read(meetupRepositoryProvider);
      final user = await repository.continueWithGoogle();
      await repository.saveProfile(user.displayName ?? 'aimasho user');
      ref.invalidate(dashboardProvider);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('로그인을 완료하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _signingIn = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authUserProvider);
    return auth.when(
        loading: () =>
            const Scaffold(body: Center(child: CircularProgressIndicator())),
        error: (error, _) =>
            Scaffold(body: Center(child: Text('로그인 상태를 불러오지 못했어요.\n$error'))),
        data: (user) {
          if (user == null || user.isAnonymous) {
            return _GuestHome(signingIn: _signingIn, onSignIn: _signIn);
          }
          final dashboard = ref.watch(dashboardProvider);
          return Scaffold(
              body: SafeArea(
                  child: RefreshIndicator(
                      onRefresh: () async {
                        ref.invalidate(dashboardProvider);
                        await ref.read(dashboardProvider.future);
                      },
                      child: dashboard.when(
                          loading: () => ListView(children: const [
                                SizedBox(height: 280),
                                Center(child: CircularProgressIndicator())
                              ]),
                          error: (error, _) => ListView(
                                  padding: const EdgeInsets.all(24),
                                  children: [
                                    _HomeHeader(user: user),
                                    const SizedBox(height: 80),
                                    Text('내 일정을 불러오지 못했어요.\n$error',
                                        textAlign: TextAlign.center),
                                    const SizedBox(height: 12),
                                    OutlinedButton(
                                        onPressed: () =>
                                            ref.invalidate(dashboardProvider),
                                        child: const Text('다시 시도'))
                                  ]),
                          data: (data) => _DashboardBody(
                              data: data,
                              user: user,
                              calendarMode: _calendarMode,
                              onModeChanged: (value) =>
                                  setState(() => _calendarMode = value))))));
        });
  }
}

class _GuestHome extends StatelessWidget {
  const _GuestHome({required this.signingIn, required this.onSignIn});
  final bool signingIn;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) => Scaffold(
          body: SafeArea(
              child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 26, 24, 30),
                  children: [
            Row(children: [
              const _Logo(),
              const Spacer(),
              TextButton(
                  onPressed: signingIn ? null : onSignIn,
                  child: const Text('로그인')),
              IconButton(
                  onPressed: () => context.push('/profile'),
                  icon: const Icon(Icons.person_outline_rounded))
            ]),
            const SizedBox(height: 82),
            const Center(child: _SunMark()),
            const SizedBox(height: 27),
            const Text('친구들의\n“언제 · 어디서 · 무엇을?”\n한곳에서 정해요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 30,
                    height: 1.42,
                    letterSpacing: -1.2,
                    fontWeight: FontWeight.w600)),
            const SizedBox(height: 18),
            const Text('날짜를 맞추고, 장소를 정하고,\n함께한 기록까지 남겨보세요.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AimashoColors.muted, height: 1.7)),
            const SizedBox(height: 34),
            ElevatedButton.icon(
                onPressed: () => context.push('/new'),
                icon: const Icon(Icons.add_rounded),
                label: const Text('약속 만들기')),
            const SizedBox(height: 10),
            OutlinedButton.icon(
                onPressed: signingIn ? null : onSignIn,
                icon: const Icon(Icons.login_rounded, size: 18),
                label: Text(signingIn ? '로그인 중...' : 'Google로 로그인')),
            const SizedBox(height: 12),
            const Text('로그인 없이도 약속을 만들 수 있고, 로그인하면 일정·친구·그룹이 저장돼요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 12, color: AimashoColors.muted, height: 1.5)),
            const SizedBox(height: 65),
            const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('언제 만나?'),
              _Arrow(),
              Text('어디서 만나?'),
              _Arrow(),
              Text('무엇을 할까?')
            ])
          ])));
}

class _DashboardBody extends StatelessWidget {
  const _DashboardBody(
      {required this.data,
      required this.user,
      required this.calendarMode,
      required this.onModeChanged});
  final HomeDashboard data;
  final User user;
  final bool calendarMode;
  final ValueChanged<bool> onModeChanged;

  @override
  Widget build(BuildContext context) {
    final unfinishedOwned = data.meetups
        .where((meetup) => meetup.isOwner && !meetup.isFinished)
        .toList();
    return ListView(
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 44),
        children: [
          _HomeHeader(user: user),
          const SizedBox(height: 28),
          const Text('MY AIMASHO', style: _eyebrowStyle),
          const SizedBox(height: 5),
          Text('${data.displayName}님의 일정',
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
                _Metric('예정', data.summary.upcomingMeetupCount),
                _Metric('함께한 약속', data.summary.completedMeetupCount),
                _Metric('친구', data.summary.friendCount),
                _Metric('그룹', data.summary.groupCount),
              ]),
          const SizedBox(height: 12),
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
            ...unfinishedOwned.map((meetup) => _MeetupTile(meetup: meetup)),
          const SizedBox(height: 28),
          Row(children: [
            const Expanded(
                child: _SectionHeader(eyebrow: 'CALENDAR', title: '모든 일정')),
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
                selected: {calendarMode},
                onSelectionChanged: (value) => onModeChanged(value.first))
          ]),
          const SizedBox(height: 10),
          if (data.meetups.isEmpty)
            const _Empty('아직 저장된 일정이 없어요.')
          else if (calendarMode)
            _CalendarPanel(meetups: data.meetups)
          else
            ...data.meetups.map((meetup) => _MeetupTile(meetup: meetup)),
          const SizedBox(height: 30),
          const _SectionHeader(eyebrow: 'TOGETHER', title: '친구'),
          if (data.relationships.isEmpty)
            const _Empty('함께 약속을 완료하면 친구 기록이 쌓여요.')
          else
            ...data.relationships.take(5).map((relationship) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                    backgroundColor: const Color(0xFFFFE5D6),
                    child: Text(relationship.displayName.characters.first)),
                title: Text(relationship.displayName,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('함께한 약속 ${relationship.sharedMeetupCount}회'),
                trailing: const Icon(Icons.chevron_right_rounded),
                onTap: () =>
                    context.push('/friends/${relationship.otherUid}'))),
          const SizedBox(height: 24),
          const _SectionHeader(eyebrow: 'GROUPS', title: '내 그룹'),
          if (data.rooms.isEmpty)
            const _Empty('프로필에서 그룹을 만들거나 초대 코드를 입력해보세요.')
          else
            ...data.rooms.map((room) => ListTile(
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
  const _CalendarPanel({required this.meetups});
  final List<DashboardMeetup> meetups;

  @override
  Widget build(BuildContext context) {
    final dated =
        meetups.where((meetup) => meetup.displayDate != null).toList();
    final anchor = dated.isEmpty ? DateTime.now() : dated.first.displayDate!;
    final first = DateTime(anchor.year, anchor.month, 1);
    final days = DateTime(anchor.year, anchor.month + 1, 0).day;
    final leading = first.weekday % 7;
    return Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
            color: const Color(0xFFFFFEFB),
            border: Border.all(color: AimashoColors.line),
            borderRadius: BorderRadius.circular(20)),
        child: Column(children: [
          Text(DateFormat('yyyy년 M월', 'ko').format(anchor),
              style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
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
                final items = dated
                    .where((meetup) =>
                        meetup.displayDate!.year == anchor.year &&
                        meetup.displayDate!.month == anchor.month &&
                        meetup.displayDate!.day == day)
                    .toList();
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
                                decoration: const BoxDecoration(
                                    color: AimashoColors.coral,
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
  const _MeetupTile({required this.meetup});
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
          _statusLabel(meetup.status),
          if (meetup.roomName != null) meetup.roomName!
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
        Text(eyebrow, style: _eyebrowStyle),
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

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({required this.user});
  final User user;
  @override
  Widget build(BuildContext context) => Row(children: [
        const _Logo(),
        const Spacer(),
        TextButton(
            onPressed: () => context.push('/new'), child: const Text('새 약속')),
        IconButton(
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.account_circle_outlined))
      ]);
}

class _Logo extends StatelessWidget {
  const _Logo();
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

class _SunMark extends StatelessWidget {
  const _SunMark();
  @override
  Widget build(BuildContext context) => Transform.rotate(
      angle: -.16,
      child: Container(
          width: 72,
          height: 72,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
              color: Color(0xFFFFB44B),
              borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(27),
                  topRight: Radius.circular(27),
                  bottomRight: Radius.circular(27),
                  bottomLeft: Radius.circular(7))),
          child: const Text('☀',
              style: TextStyle(fontSize: 40, color: Color(0xFFFFF7DC)))));
}

class _Arrow extends StatelessWidget {
  const _Arrow();
  @override
  Widget build(BuildContext context) => const Padding(
      padding: EdgeInsets.symmetric(horizontal: 8),
      child: Text('→', style: TextStyle(color: AimashoColors.coral)));
}

String _statusLabel(String status) => switch (status) {
      'SCHEDULING' => '날짜 조율 중',
      'SCHEDULE_CONFIRMED' => '날짜 확정',
      'LOCATION_COLLECTING' => '출발지 수집 중',
      'LOCATION_SELECTING' => '장소 선택 중',
      'LOCATION_CONFIRMED' || 'READY' => '준비 완료',
      'COMPLETED' => '완료',
      'CANCELLED' => '취소',
      _ => status
    };

const _eyebrowStyle = TextStyle(
    fontSize: 11,
    color: AimashoColors.coral,
    letterSpacing: 1.2,
    fontWeight: FontWeight.w800);
