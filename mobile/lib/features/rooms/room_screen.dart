// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
  late Future<RoomDetail> _detail;
  @override
  void initState() {
    super.initState();
    _detail = ref.read(meetupRepositoryProvider).roomDetail(widget.roomId);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const Text('Room',
                style: TextStyle(fontWeight: FontWeight.w800))),
        body: FutureBuilder<RoomDetail>(
          future: _detail,
          builder: (context, snapshot) {
            if (snapshot.hasError)
              return Center(
                  child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text('Room을 불러올 수 없어요.\n${snapshot.error}',
                          textAlign: TextAlign.center)));
            if (!snapshot.hasData)
              return const Center(child: CircularProgressIndicator());
            final detail = snapshot.data!;
            return ListView(padding: const EdgeInsets.all(24), children: [
              const Text('YOUR ROOM',
                  style: TextStyle(
                      fontSize: 11,
                      color: AimashoColors.coral,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800)),
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
                  child: Row(children: [
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
                        child: const Text('+ 새 약속')),
                  ])),
              const SizedBox(height: 25),
              const Text('MEMBERS',
                  style: TextStyle(
                      fontSize: 11,
                      color: AimashoColors.coral,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800)),
              ...detail.members.map((member) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                      backgroundColor: const Color(0xFFFFE5D6),
                      child: Text(member.displayName.substring(0, 1))),
                  title: Text(member.displayName),
                  trailing: Text(member.role == 'OWNER' ? '관리자' : '멤버',
                      style: const TextStyle(
                          fontSize: 11, color: AimashoColors.muted)))),
              const SizedBox(height: 15),
              const Text('MEETUPS',
                  style: TextStyle(
                      fontSize: 11,
                      color: AimashoColors.coral,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              if (detail.meetups.isEmpty)
                const Padding(
                    padding: EdgeInsets.only(top: 9),
                    child: Text('아직 Room에서 만든 약속이 없어요.',
                        style: TextStyle(color: AimashoColors.muted)))
              else
                ...detail.meetups.map((meetup) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(meetup.title,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(meetup.status.replaceAll('_', ' ')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/m/${meetup.id}/plan'))),
            ]);
          },
        ),
      );
}
