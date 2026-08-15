// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../providers/meetup_providers.dart';

class JoinRoomScreen extends ConsumerStatefulWidget {
  const JoinRoomScreen({super.key, required this.inviteCode});
  final String inviteCode;
  @override
  ConsumerState<JoinRoomScreen> createState() => _JoinRoomScreenState();
}

class _JoinRoomScreenState extends ConsumerState<JoinRoomScreen> {
  late Future<Map<String, String>> _preview;
  final _name = TextEditingController();
  bool _anonymous = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _preview =
        ref.read(meetupRepositoryProvider).roomInvitePreview(widget.inviteCode);
    _checkAccount();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _checkAccount() async {
    final user = await ref.read(meetupRepositoryProvider).ensureAnonymousUser();
    if (mounted)
      setState(() {
        _anonymous = user.isAnonymous;
        _name.text = user.displayName ?? '';
      });
  }

  Future<void> _upgrade() async {
    setState(() => _busy = true);
    try {
      final user =
          await ref.read(meetupRepositoryProvider).continueWithGoogle();
      final name = user.displayName ??
          (_name.text.isEmpty ? 'aimasho user' : _name.text);
      await ref.read(meetupRepositoryProvider).saveProfile(name);
      if (mounted)
        setState(() {
          _anonymous = false;
          _name.text = name;
        });
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Google 연결을 완료하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    if (_name.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final roomId = await ref
          .read(meetupRepositoryProvider)
          .joinRoom(widget.inviteCode, _name.text.trim());
      if (mounted) context.go('/rooms/$roomId');
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Room에 참여하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
          body: SafeArea(
              child: FutureBuilder<Map<String, String>>(
        future: _preview,
        builder: (context, snapshot) {
          if (snapshot.hasError)
            return Center(
                child: Text('Room 초대를 불러올 수 없어요.\n${snapshot.error}',
                    textAlign: TextAlign.center));
          if (!snapshot.hasData)
            return const Center(child: CircularProgressIndicator());
          final room = snapshot.data!;
          return Center(
              child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Container(
                      padding: const EdgeInsets.all(30),
                      decoration: BoxDecoration(
                          color: const Color(0xFFFFFEFA),
                          border: Border.all(color: AimashoColors.line),
                          borderRadius: BorderRadius.circular(28)),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        const Text('👥', style: TextStyle(fontSize: 38)),
                        const SizedBox(height: 12),
                        const Text('YOU\'RE INVITED',
                            style: TextStyle(
                                fontSize: 11,
                                color: AimashoColors.coral,
                                letterSpacing: 1.2,
                                fontWeight: FontWeight.w800)),
                        const SizedBox(height: 7),
                        Text(room['name']!,
                            style: Theme.of(context)
                                .textTheme
                                .headlineSmall
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        Text(
                            '${room['ownerName']}님이 이 Room에 초대했어요.\n다음 약속도 계속 함께할 수 있어요.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: AimashoColors.muted, height: 1.6)),
                        const SizedBox(height: 22),
                        if (_anonymous) ...[
                          ElevatedButton(
                              onPressed: _busy ? null : _upgrade,
                              child: Text(_busy ? '연결 중...' : 'Google로 계속하기')),
                          const SizedBox(height: 8),
                          const Text('Room은 계정으로만 참여할 수 있어요.',
                              style: TextStyle(
                                  fontSize: 11, color: AimashoColors.muted))
                        ] else ...[
                          TextField(
                              controller: _name,
                              decoration: const InputDecoration(
                                  hintText: '표시할 이름', isDense: true)),
                          const SizedBox(height: 12),
                          ElevatedButton(
                              onPressed: _busy ? null : _join,
                              child: Text(_busy ? '참여 중...' : 'Room 참여하기'))
                        ],
                      ]))));
        },
      )));
}
