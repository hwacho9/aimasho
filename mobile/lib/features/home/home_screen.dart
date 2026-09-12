import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../providers/meetup_providers.dart';
import '../social/social_home.dart';
import 'home_dashboard_view.dart' show AimashoWordmark;

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _signingIn = false;

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
          return SocialHome(key: ValueKey(user.uid));
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
              const AimashoWordmark(),
              const Spacer(),
              TextButton(
                  onPressed: signingIn ? null : onSignIn,
                  child: const Text('로그인')),
              IconButton(
                  onPressed: () => context.push('/profile'),
                  icon: const Icon(Icons.person_outline_rounded))
            ]),
            const SizedBox(height: 28),
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
                label: const Text('로그인 없이 모임 만들기')),
            const SizedBox(height: 14),
            Wrap(spacing: 8, children: [
              ActionChip(
                  label: const Text('밥 한번 먹자'),
                  onPressed: () => context.push('/new?template=food')),
              ActionChip(
                  label: const Text('같이 놀러 가자'),
                  onPressed: () => context.push('/new?template=activity')),
            ]),
            const SizedBox(height: 14),
            OutlinedButton.icon(
                onPressed: signingIn ? null : onSignIn,
                icon: const Icon(Icons.login_rounded, size: 18),
                label: Text(signingIn ? '로그인 중...' : 'Google로 로그인')),
            const SizedBox(height: 12),
            const Text('로그인 없이도 약속을 만들 수 있고, 로그인하면 일정·친구·그룹이 저장돼요.',
                textAlign: TextAlign.center,
                style: TextStyle(
                    fontSize: 12, color: AimashoColors.muted, height: 1.5)),
            const SizedBox(height: 28),
            const _GuestRecentMeetups(),
            const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('언제 만나?'),
              _Arrow(),
              Text('어디서 만나?'),
              _Arrow(),
              Text('무엇을 할까?')
            ])
          ])));
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

class _GuestRecentMeetups extends ConsumerWidget {
  const _GuestRecentMeetups();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authUserProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();
    final recent = ref.watch(guestMeetupsProvider);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const Text('이 기기에서 참여한 모임',
          style: TextStyle(fontSize: 19, fontWeight: FontWeight.bold)),
      const Text('브라우저 데이터 삭제나 기기 변경에 대비해 초대 링크를 보관해주세요. 일부 모임을 표시합니다.',
          style: TextStyle(fontSize: 12, color: AimashoColors.muted)),
      recent.when(
          loading: () => const LinearProgressIndicator(),
          error: (_, __) => TextButton(
              onPressed: () => ref.invalidate(guestMeetupsProvider),
              child: const Text('모임 다시 불러오기')),
          data: (meetups) => Column(
              children: meetups
                  .map((meetup) => ListTile(
                      title: Text(meetup.title),
                      subtitle: Text(meetup.confirmedDateTime == null
                          ? '아직 조율 중'
                          : '일정 확정'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/m/${meetup.id}/plan')))
                  .toList())),
      const SizedBox(height: 24),
    ]);
  }
}
