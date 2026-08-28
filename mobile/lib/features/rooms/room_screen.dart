import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class RoomScreen extends ConsumerStatefulWidget {
  const RoomScreen({super.key, required this.roomId});
  final String roomId;

  @override
  ConsumerState<RoomScreen> createState() => _RoomScreenState();
}

class _RoomScreenState extends ConsumerState<RoomScreen> {
  Future<RoomDetail>? _detail;
  bool _busy = false;
  String _filter = 'ALL';

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final repository = ref.read(meetupRepositoryProvider);
    final user = await repository.ensureAnonymousUser();
    if (!user.isAnonymous && mounted) {
      setState(() => _detail = repository.roomDetail(widget.roomId));
    }
  }

  Future<void> _signIn() async {
    setState(() => _busy = true);
    try {
      final repository = ref.read(meetupRepositoryProvider);
      final user = await repository.continueWithGoogle();
      await repository.saveProfile(user.displayName ?? 'aimasho user');
      ref.invalidate(dashboardProvider);
      if (mounted) {
        setState(() => _detail = repository.roomDetail(widget.roomId));
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('로그인을 완료하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _inviteUrl(RoomDetail detail) =>
      'https://aimasho.web.app/r/${detail.room.inviteCode}';

  Future<void> _share(RoomDetail detail) async {
    await Share.share('${detail.room.name} 그룹에 초대해요!\n${_inviteUrl(detail)}',
        subject: '${detail.room.name} · aimasho 그룹 초대');
  }

  Future<void> _copy(RoomDetail detail) async {
    await Clipboard.setData(ClipboardData(text: _inviteUrl(detail)));
    if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('초대 링크를 복사했어요.')));
    }
  }

  Future<void> _delete(RoomDetail detail) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('그룹을 삭제할까요?'),
            content: const Text('그룹과 멤버 정보만 삭제되며 지금까지의 약속 기록은 남아요.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('취소')),
              TextButton(
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('삭제'))
            ],
          ),
        ) ??
        false;
    if (!confirmed) return;
    setState(() => _busy = true);
    try {
      await ref.read(meetupRepositoryProvider).deleteRoom(widget.roomId);
      ref.invalidate(dashboardProvider);
      if (mounted) context.go('/');
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('그룹을 삭제하지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authUserProvider).valueOrNull;
    return Scaffold(
        appBar: AppBar(
            title: const Text('그룹',
                style: TextStyle(fontWeight: FontWeight.w800))),
        body: user == null || user.isAnonymous
            ? _AccountRequired(busy: _busy, onSignIn: _signIn)
            : _detail == null
                ? const Center(child: CircularProgressIndicator())
                : FutureBuilder<RoomDetail>(
                    future: _detail,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return Center(
                            child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text('그룹을 불러올 수 없어요.\n${snapshot.error}',
                                          textAlign: TextAlign.center),
                                      const SizedBox(height: 12),
                                      OutlinedButton(
                                          onPressed: _initialize,
                                          child: const Text('다시 시도'))
                                    ])));
                      }
                      if (!snapshot.hasData) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      return _body(snapshot.data!);
                    }));
  }

  Widget _body(RoomDetail detail) {
    final filtered = detail.meetups.where((meetup) {
      if (_filter == 'UPCOMING') {
        return meetup.status != 'COMPLETED' && meetup.status != 'CANCELLED';
      }
      if (_filter == 'PAST') return meetup.status == 'COMPLETED';
      if (_filter == 'CANCELLED') return meetup.status == 'CANCELLED';
      return true;
    }).toList();
    final isOwner = detail.ownerUid == ref.read(currentUidProvider).valueOrNull;
    return RefreshIndicator(
        onRefresh: () async {
          final next =
              ref.read(meetupRepositoryProvider).roomDetail(widget.roomId);
          setState(() => _detail = next);
          await next;
        },
        child: ListView(padding: const EdgeInsets.all(24), children: [
          const Text('YOUR GROUP', style: _eyebrow),
          const SizedBox(height: 5),
          Text(detail.room.name,
              style: Theme.of(context)
                  .textTheme
                  .headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          Container(
              margin: const EdgeInsets.only(top: 18),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                  color: const Color(0xFFFFE6D7),
                  borderRadius: BorderRadius.circular(20)),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                            const Text('같은 멤버와 다음 약속도 쉽게',
                                style: TextStyle(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 5),
                            Text('초대 코드  ${detail.room.inviteCode}',
                                style: const TextStyle(
                                    fontSize: 12, color: AimashoColors.muted))
                          ])),
                      FilledButton(
                          onPressed: () =>
                              context.push('/new?roomId=${widget.roomId}'),
                          child: const Text('+ 새 약속'))
                    ]),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                          child: OutlinedButton.icon(
                              onPressed: () => _share(detail),
                              icon:
                                  const Icon(Icons.ios_share_rounded, size: 17),
                              label: const Text('멤버 초대'))),
                      const SizedBox(width: 8),
                      IconButton.outlined(
                          tooltip: '초대 링크 복사',
                          onPressed: () => _copy(detail),
                          icon: const Icon(Icons.link_rounded))
                    ])
                  ])),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
                child: _SummaryCard(
                    value: detail.summary.completedMeetupCount,
                    label: '함께한 약속')),
            const SizedBox(width: 10),
            Expanded(
                child: _SummaryCard(
                    value: detail.summary.uniquePlaceCount, label: '가본 장소'))
          ]),
          const SizedBox(height: 28),
          const Text('MEMBERS', style: _eyebrow),
          ...detail.members.map((member) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                  backgroundColor: const Color(0xFFFFE5D6),
                  child: Text(member.displayName.characters.first)),
              title: Text(member.displayName),
              trailing: Text(member.role == 'OWNER' ? '관리자' : '멤버',
                  style: const TextStyle(
                      fontSize: 11, color: AimashoColors.muted)))),
          if (detail.mapPlaces.isNotEmpty) ...[
            const SizedBox(height: 22),
            const Text('PLACES', style: _eyebrow),
            const SizedBox(height: 6),
            Text('함께 간 장소',
                style: Theme.of(context)
                    .textTheme
                    .titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            ...detail.mapPlaces.take(5).map((visit) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.place_outlined,
                    color: AimashoColors.coral),
                title: Text(visit.place.name),
                trailing: Text('${visit.count}회')))
          ],
          const SizedBox(height: 22),
          const Text('MEETUPS', style: _eyebrow),
          const SizedBox(height: 8),
          SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SegmentedButton<String>(
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment(value: 'ALL', label: Text('전체')),
                    ButtonSegment(value: 'UPCOMING', label: Text('예정')),
                    ButtonSegment(value: 'PAST', label: Text('과거')),
                    ButtonSegment(value: 'CANCELLED', label: Text('취소'))
                  ],
                  selected: {_filter},
                  onSelectionChanged: (value) =>
                      setState(() => _filter = value.first))),
          if (filtered.isEmpty)
            const Padding(
                padding: EdgeInsets.only(top: 16),
                child: Text('표시할 약속이 없어요.',
                    style: TextStyle(color: AimashoColors.muted)))
          else
            ...filtered.map((meetup) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(meetup.title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text([
                  _statusLabel(meetup.status),
                  if (meetup.confirmedDateTime != null)
                    DateFormat('M/d HH:mm').format(meetup.confirmedDateTime!),
                  if (meetup.occurrence != null) '${meetup.occurrence}번째 만남'
                ].join(' · ')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/m/${meetup.id}/plan'))),
          if (isOwner) ...[
            const SizedBox(height: 32),
            Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFF0B5A6)),
                    borderRadius: BorderRadius.circular(18)),
                child: Row(children: [
                  const Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text('그룹 관리',
                            style: TextStyle(
                                color: AimashoColors.coral,
                                fontWeight: FontWeight.w800)),
                        SizedBox(height: 4),
                        Text('약속 기록은 남기고 그룹만 삭제해요.',
                            style: TextStyle(
                                fontSize: 11, color: AimashoColors.muted))
                      ])),
                  OutlinedButton(
                      onPressed: _busy ? null : () => _delete(detail),
                      child: const Text('그룹 삭제'))
                ]))
          ]
        ]));
  }
}

class _AccountRequired extends StatelessWidget {
  const _AccountRequired({required this.busy, required this.onSignIn});
  final bool busy;
  final VoidCallback onSignIn;
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.groups_rounded,
                color: AimashoColors.coral, size: 52),
            const SizedBox(height: 16),
            const Text('로그인하고 그룹을 계속 사용하세요',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('멤버·약속 기록과 초대 링크를 여러 기기에서 안전하게 확인할 수 있어요.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AimashoColors.muted, height: 1.6)),
            const SizedBox(height: 20),
            ElevatedButton(
                onPressed: busy ? null : onSignIn,
                child: Text(busy ? '로그인 중...' : 'Google로 로그인'))
          ])));
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.value, required this.label});
  final int value;
  final String label;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: const Color(0xFFFFF0E8),
          borderRadius: BorderRadius.circular(18)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$value',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text(label,
            style: const TextStyle(fontSize: 11, color: AimashoColors.muted))
      ]));
}

String _statusLabel(String status) => switch (status) {
      'SCHEDULING' => '조율 중',
      'COMPLETED' => '완료',
      'CANCELLED' => '취소',
      _ => '예정'
    };

const _eyebrow = TextStyle(
    fontSize: 11,
    color: AimashoColors.coral,
    letterSpacing: 1.2,
    fontWeight: FontWeight.w800);
