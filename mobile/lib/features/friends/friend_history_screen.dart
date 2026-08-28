import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class FriendHistoryScreen extends ConsumerStatefulWidget {
  const FriendHistoryScreen({super.key, required this.otherUid});
  final String otherUid;

  @override
  ConsumerState<FriendHistoryScreen> createState() =>
      _FriendHistoryScreenState();
}

class _FriendHistoryScreenState extends ConsumerState<FriendHistoryScreen> {
  late Future<FriendHistory> _history;

  @override
  void initState() {
    super.initState();
    _history =
        ref.read(meetupRepositoryProvider).friendHistory(widget.otherUid);
  }

  Future<void> _refresh() async {
    final next =
        ref.read(meetupRepositoryProvider).friendHistory(widget.otherUid);
    setState(() => _history = next);
    await next;
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(
          title: const Text('친구 기록',
              style: TextStyle(fontWeight: FontWeight.w800))),
      body: FutureBuilder<FriendHistory>(
          future: _history,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                  child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('친구 기록을 불러오지 못했어요.\n${snapshot.error}',
                          textAlign: TextAlign.center)));
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final history = snapshot.data!;
            return RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(
                    padding: const EdgeInsets.fromLTRB(24, 22, 24, 42),
                    children: [
                      const Text('TOGETHER',
                          style: TextStyle(
                              color: AimashoColors.coral,
                              fontSize: 11,
                              letterSpacing: 1.2,
                              fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text('${history.displayName}님과의 기록',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 18),
                      Container(
                          padding: const EdgeInsets.all(18),
                          decoration: BoxDecoration(
                              color: const Color(0xFFFFF0E8),
                              borderRadius: BorderRadius.circular(18)),
                          child: Row(children: [
                            Text('${history.completedMeetupCount}',
                                style: const TextStyle(
                                    fontSize: 28, fontWeight: FontWeight.w800)),
                            const SizedBox(width: 10),
                            const Text('번 함께 만났어요',
                                style: TextStyle(
                                    color: AimashoColors.muted,
                                    fontWeight: FontWeight.w700))
                          ])),
                      const SizedBox(height: 28),
                      const Text('약속 타임라인',
                          style: TextStyle(
                              fontSize: 20, fontWeight: FontWeight.w800)),
                      if (history.meetups.isEmpty)
                        const Padding(
                            padding: EdgeInsets.only(top: 16),
                            child: Text('함께한 약속 기록이 아직 없어요.',
                                style: TextStyle(color: AimashoColors.muted)))
                      else
                        ...history.meetups.map((meetup) => _HistoryTile(
                            meetup: meetup,
                            onTap: () => context.push('/m/${meetup.id}/plan')))
                    ]));
          }));
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.meetup, required this.onTap});
  final DashboardMeetup meetup;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final date = meetup.completedAt ?? meetup.displayDate;
    return IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SizedBox(
          width: 28,
          child: Column(children: [
            Container(
                width: 11,
                height: 11,
                margin: const EdgeInsets.only(top: 22),
                decoration: const BoxDecoration(
                    color: AimashoColors.coral, shape: BoxShape.circle)),
            Expanded(child: Container(width: 2, color: const Color(0xFFF0D8CC)))
          ])),
      Expanded(
          child: ListTile(
              contentPadding: const EdgeInsets.symmetric(vertical: 7),
              title: Text(meetup.title,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text([
                if (date != null) DateFormat('yyyy.M.d HH:mm').format(date),
                if (meetup.meetingPlace != null) meetup.meetingPlace!.name,
                meetup.status == 'COMPLETED' ? '완료' : '예정'
              ].join(' · ')),
              trailing: const Icon(Icons.chevron_right_rounded),
              onTap: onTap))
    ]));
  }
}
