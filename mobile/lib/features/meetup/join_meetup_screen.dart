import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class JoinMeetupScreen extends ConsumerStatefulWidget {
  const JoinMeetupScreen({super.key, required this.meetupId});
  final String meetupId;
  @override
  ConsumerState<JoinMeetupScreen> createState() => _JoinMeetupScreenState();
}

class _JoinMeetupScreenState extends ConsumerState<JoinMeetupScreen> {
  late Future<InvitePreview> _preview;
  final _name = TextEditingController();
  bool _joining = false;
  @override
  void initState() {
    super.initState();
    _preview =
        ref.read(meetupRepositoryProvider).getInvitePreview(widget.meetupId);
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    if (_name.text.trim().isEmpty) return;
    setState(() => _joining = true);
    try {
      await ref
          .read(meetupRepositoryProvider)
          .joinMeetup(widget.meetupId, _name.text.trim());
      if (mounted) context.go('/m/${widget.meetupId}/plan');
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('참여할 수 없어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: FutureBuilder<InvitePreview>(
            future: _preview,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Center(
                    child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text('초대를 불러올 수 없어요.\n${snapshot.error}',
                            textAlign: TextAlign.center)));
              }
              if (!snapshot.hasData) {
                return const Center(child: CircularProgressIndicator());
              }
              final invite = snapshot.data!;
              if (invite.isAlreadyParticipant) {
                WidgetsBinding.instance.addPostFrameCallback(
                    (_) => context.go('/m/${widget.meetupId}/plan'));
                return const SizedBox.shrink();
              }
              return Center(
                  child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: Container(
                          padding: const EdgeInsets.all(30),
                          decoration: BoxDecoration(
                              color: const Color(0xFFFFFEFA),
                              border: Border.all(color: AimashoColors.line),
                              borderRadius: BorderRadius.circular(28)),
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                            Transform.rotate(
                                angle: -.12,
                                child: Container(
                                    width: 43,
                                    height: 43,
                                    alignment: Alignment.center,
                                    decoration: const BoxDecoration(
                                        color: Color(0xFFFFE3D3),
                                        borderRadius: BorderRadius.only(
                                            topLeft: Radius.circular(13),
                                            topRight: Radius.circular(13),
                                            bottomRight: Radius.circular(13),
                                            bottomLeft: Radius.circular(4))),
                                    child: const Text('✦',
                                        style: TextStyle(
                                            color: AimashoColors.coral,
                                            fontSize: 25)))),
                            const SizedBox(height: 18),
                            const Text('YOU\'RE INVITED',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: AimashoColors.coral,
                                    letterSpacing: 1.2,
                                    fontWeight: FontWeight.w800)),
                            const SizedBox(height: 8),
                            Text(invite.title,
                                textAlign: TextAlign.center,
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineSmall
                                    ?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 13),
                            Text(
                                '${invite.hostName}님이 초대했어요.\n이름을 알려주시면 바로 참여할 수 있어요.',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    color: AimashoColors.muted, height: 1.7)),
                            const SizedBox(height: 25),
                            Align(
                                alignment: Alignment.centerLeft,
                                child: Text('이름',
                                    style: Theme.of(context)
                                        .textTheme
                                        .labelLarge
                                        ?.copyWith(
                                            fontWeight: FontWeight.w800))),
                            const SizedBox(height: 8),
                            TextField(
                                controller: _name,
                                autofocus: true,
                                maxLength: 60,
                                decoration: const InputDecoration(
                                    hintText: '예: 유키', counterText: '')),
                            const SizedBox(height: 18),
                            ElevatedButton(
                                onPressed: _joining ? null : _join,
                                child: Text(_joining ? '참여 중...' : '참여하기')),
                          ]))));
            },
          ),
        ),
      );
}
