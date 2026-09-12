import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../models/social.dart';
import '../../providers/meetup_providers.dart';
import '../home/home_dashboard_view.dart';
import 'memory_notes_panel.dart';

class SocialHome extends ConsumerStatefulWidget {
  const SocialHome({super.key});
  @override
  ConsumerState<SocialHome> createState() => _SocialHomeState();
}

class _SocialHomeState extends ConsumerState<SocialHome> {
  int _tab = 0;
  String t(String ko, String ja) =>
      Localizations.localeOf(context).languageCode == 'ja' ? ja : ko;
  Future<void> _refresh() async {
    ref.read(meetupRepositoryProvider).invalidateDashboardCache();
    ref.invalidate(dashboardProvider);
    ref.invalidate(socialOverviewProvider);
    // Keep both loads independent; one failure must not hide the other section.
    await Future.wait([
      ref.read(dashboardProvider.future).then<void>((_) {}, onError: (_) {}),
      ref
          .read(socialOverviewProvider.future)
          .then<void>((_) {}, onError: (_) {})
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardProvider);
    final social = ref.watch(socialOverviewProvider);
    final data = dashboard.isLoading ? null : dashboard.valueOrNull;
    final overview = social.isLoading ? null : social.valueOrNull;
    final name =
        ref.watch(authUserProvider).valueOrNull?.displayName ?? 'aimasho';
    final active = data?.meetups
            .where(
                (meetup) => !['COMPLETED', 'CANCELLED'].contains(meetup.status))
            .toList() ??
        <DashboardMeetup>[];
    final planning =
        active.where((meetup) => meetup.confirmedDateTime == null).toList();
    final wrapup = active
        .where((meetup) =>
            meetup.isOwner &&
            (meetup.confirmedDateTime?.isBefore(DateTime.now()) ?? false))
        .toList();
    final future = active
        .where((meetup) =>
            meetup.confirmedDateTime?.isAfter(DateTime.now()) ?? false)
        .toList()
      ..sort((a, b) => a.confirmedDateTime!.compareTo(b.confirmedDateTime!));
    return Scaffold(
      bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (index) => setState(() => _tab = index),
          destinations: [
            NavigationDestination(
                icon: const Icon(Icons.wb_sunny_outlined),
                label: t('우리', 'ホーム')),
            NavigationDestination(
                icon: const Icon(Icons.calendar_month_outlined),
                label: t('약속', '予定')),
            NavigationDestination(
                icon: const Icon(Icons.people_outline),
                label: t('친구·그룹', '友だち')),
            NavigationDestination(
                icon: const Icon(Icons.auto_awesome_outlined),
                label: t('추억', '思い出')),
          ]),
      body: SafeArea(
          child: RefreshIndicator(
              onRefresh: _refresh,
              child: _tab == 1 && data != null
                  ? HomeDashboardView(data: data)
                  : ListView(
                      key: ValueKey(_tab),
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
                      children: [
                          const HomeDashboardHeader(),
                          const SizedBox(height: 28),
                          Text(t('우리의 다음 이야기', '次の思い出を、一緒に。'),
                              style: const TextStyle(
                                  color: AimashoColors.coral,
                                  fontWeight: FontWeight.bold)),
                          Text(t('$name님, 또 만나요.', '$nameさん、また会おう。'),
                              style: const TextStyle(
                                  fontSize: 27, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 18),
                          FilledButton.icon(
                              onPressed: () => context.push('/new'),
                              icon: const Icon(Icons.add),
                              label: Text(t('모임 만들기', '予定をつくる'))),
                          if (dashboard.isLoading)
                            const Padding(
                                padding: EdgeInsets.all(20),
                                child: LinearProgressIndicator()),
                          if (dashboard.hasError)
                            _retry(t('일정을 불러오지 못했어요.', '予定を読み込めませんでした。')),
                          if ((_tab == 0 || _tab == 2) && data != null)
                            HomeGroupsPanel(rooms: data.rooms),
                          if (_tab == 0 && data != null) ...[
                            _heading(t('다음에 만날 날', '次に会う日')),
                            _box(
                                color: const Color(0xFFFFE8D8),
                                child: future.isEmpty
                                    ? Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                            Text(t('가볍게, 밥 한번?', '気軽に、ごはんでも？'),
                                                style: const TextStyle(
                                                    fontSize: 24,
                                                    fontWeight:
                                                        FontWeight.bold)),
                                            TextButton(
                                                onPressed: () => context
                                                    .push('/new?template=food'),
                                                child: Text(t('식사 모임 만들기 →',
                                                    'ごはんの予定をつくる →'))),
                                          ])
                                    : _meetup(future.first)),
                            _heading(t('함께 정하는 중 · ${planning.length}',
                                'みんなで相談中・${planning.length}')),
                            ...planning.take(3).map(_meetup),
                            TextButton(
                                onPressed: () => setState(() => _tab = 1),
                                child: Text(
                                    t('미완성 모임까지 전체 보기 →', '未確定の予定もすべて見る →'))),
                            if (wrapup.isNotEmpty) ...[
                              _heading(t('지난 모임 ${wrapup.length}개, 추억으로 남길까요?',
                                  '過ぎた予定${wrapup.length}件を、思い出にしよう')),
                              _empty(t(
                                  '실제로 만났다면 당일 플랜에서 완료해주세요. 자동으로 만남 횟수를 늘리지 않아요.',
                                  '実際に会ったら当日プランから完了にしてください。回数は自動で増やしません。')),
                              ...wrapup.take(2).map(_meetup),
                            ],
                          ],
                          if (_tab != 1) ...[
                            if (social.isLoading)
                              const Padding(
                                  padding: EdgeInsets.all(20),
                                  child: LinearProgressIndicator()),
                            if (social.hasError)
                              _retry(t('친구·추억을 불러오지 못했어요. 일정은 계속 관리할 수 있어요.',
                                  '友だち・思い出を読み込めませんでした。予定の管理は続けられます。')),
                            if (social.valueOrNull?.limited == true)
                              Text(t('일부 모임 기준으로 표시합니다. 평생 누적 횟수가 아닙니다.',
                                  '一部の予定をもとに表示しています。全期間の合計ではありません。')),
                            if (overview != null) ...[
                              if (_tab == 0 || _tab == 2) ...[
                                _heading(t('만날수록 쌓이는 우리', '会うたび、増えるつながり')),
                                if (overview.friends.isEmpty)
                                  _empty(t('같은 모임에 참여한 가입 친구가 여기에 모여요.',
                                      '同じ予定に参加した登録済みの友だちがここに集まります。')),
                                ...(_tab == 0
                                        ? overview.friends.take(3)
                                        : overview.friends)
                                    .map((friend) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 12),
                                        child:
                                            SocialFriendCard(friend: friend))),
                                Text(
                                    t('완료한 모임에서 불참 응답을 제외한 기록이에요. 우정 점수나 실제 참석 증명은 아니에요.',
                                        '完了した予定から不参加を除いた記録です。友情の点数や出席の証明ではありません。'),
                                    style: const TextStyle(
                                        color: AimashoColors.muted,
                                        fontSize: 12)),
                              ],
                              if (_tab == 0 || _tab == 3) ...[
                                _heading(t('우리만의 작은 피드', '私たちだけの思い出')),
                                OutlinedButton.icon(
                                    onPressed: () => context.push('/journey'),
                                    icon: const Icon(Icons.map_outlined),
                                    label: Text(t('지도로 되돌아보기', 'マップで振り返る'))),
                                if (overview.memories.isEmpty)
                                  _empty(t('모임 방에서 호스트가 완료하면 한 줄 추억을 남길 수 있어요.',
                                      '予定でホストが完了すると、ひとことを残せます。')),
                                ...(_tab == 0
                                        ? overview.memories.take(2)
                                        : overview.memories)
                                    .map((memory) => _MemoryCard(
                                        key: ValueKey(memory.id),
                                        memory: memory)),
                              ],
                            ],
                          ],
                        ]))),
    );
  }

  Widget _retry(String message) => _box(
          child: Column(children: [
        Text(message),
        TextButton(onPressed: _refresh, child: Text(t('다시 시도', '再試行')))
      ]));
  Widget _heading(String value) => Padding(
      padding: const EdgeInsets.only(top: 26, bottom: 12),
      child: Text(value,
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)));
  Widget _empty(String value) => _box(
      child: Text(value,
          style: const TextStyle(height: 1.6, color: AimashoColors.muted)));
  Widget _meetup(DashboardMeetup meetup) => ListTile(
      contentPadding: EdgeInsets.zero,
      leading:
          const Icon(Icons.calendar_today_outlined, color: AimashoColors.coral),
      title: Text(meetup.title,
          style: const TextStyle(fontWeight: FontWeight.bold)),
      subtitle: Text(meetup.confirmedDateTime == null
          ? t('날짜 조율 중 · 미확정', '日程を相談中・未確定')
          : DateFormat('M/d HH:mm').format(meetup.confirmedDateTime!)),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.push('/m/${meetup.id}/plan'));
  Widget _box({required Widget child, Color color = Colors.white}) => Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFEBDDD1))),
      child: child);
}

class HomeGroupsPanel extends StatelessWidget {
  const HomeGroupsPanel({super.key, required this.rooms});
  final List<DashboardRoom> rooms;

  @override
  Widget build(BuildContext context) {
    final ja = Localizations.localeOf(context).languageCode == 'ja';
    return Container(
        margin: const EdgeInsets.only(top: 20),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AimashoColors.line)),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(ja ? 'マイグループ · ${rooms.length}' : '내 그룹 · ${rooms.length}',
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          if (rooms.isEmpty)
            Text(ja
                ? 'まだグループはありません。作成するか、招待コードで参加してみましょう。'
                : '아직 그룹이 없어요. 그룹을 만들거나 초대 코드로 참여해보세요.'),
          ...rooms.map((room) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading:
                  const Icon(Icons.groups_outlined, color: AimashoColors.coral),
              title: Text(room.name,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              subtitle: Text(room.role == 'OWNER'
                  ? ja
                      ? '管理者'
                      : '관리자'
                  : ja
                      ? 'メンバー'
                      : '멤버'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/rooms/${room.id}'))),
          const SizedBox(height: 8),
          OutlinedButton.icon(
              onPressed: () => context.push('/profile'),
              icon: const Icon(Icons.add),
              label: Text(ja ? 'グループの作成・参加' : '그룹 만들기·참여')),
        ]));
  }
}

class SocialFriendCard extends StatelessWidget {
  const SocialFriendCard({super.key, required this.friend});
  final SocialFriend friend;
  @override
  Widget build(BuildContext context) {
    final ja = Localizations.localeOf(context).languageCode == 'ja';
    final labels = ja
        ? ['最初の思い出へ', 'はじめての思い出', '会うのが楽しみ', 'いつもの仲間', '重なる思い出', 'ずっと続くつながり']
        : ['첫 만남을 기다리며', '첫 추억', '반가운 사이', '우리의 단골', '쌓여가는 이야기', '오래 이어온 우리'];
    return Card(
        margin: EdgeInsets.zero,
        child: Padding(
            padding: const EdgeInsets.all(20),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                CircleAvatar(
                    backgroundColor: const Color(0xFF7C9986),
                    child: Text(friend.displayName.characters.first,
                        style: const TextStyle(color: Colors.white))),
                const SizedBox(width: 12),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(friend.displayName,
                          style: const TextStyle(
                              fontSize: 19, fontWeight: FontWeight.bold)),
                      Text(labels[friend.level.clamp(0, 5)],
                          style: const TextStyle(fontSize: 12))
                    ]))
              ]),
              const SizedBox(height: 15),
              Text(
                  ja
                      ? '${friend.completedCount}回の思い出'
                      : '${friend.completedCount}번의 만남 기록',
                  style: const TextStyle(
                      fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              LinearProgressIndicator(
                  value: friend.progress.clamp(0, 1),
                  color: const Color(0xFF7C9986),
                  backgroundColor: const Color(0xFFF3EAE4)),
              const SizedBox(height: 8),
              Text(
                  friend.next == null
                      ? (ja ? 'これからも一緒に' : '함께 쌓아가는 이야기')
                      : ja
                          ? '次の節目まであと${friend.next! - friend.completedCount}回'
                          : '다음 이정표까지 ${friend.next! - friend.completedCount}번',
                  style: const TextStyle(fontSize: 12)),
              Text(
                  ja
                      ? '進行中の予定 ${friend.plannedCount}件'
                      : '진행 중 약속 ${friend.plannedCount}개',
                  style: const TextStyle(color: AimashoColors.muted)),
              TextButton(
                  onPressed: () => context.push('/friends/${friend.uid}'),
                  child: Text(ja ? 'ふたりの記録を見る →' : '둘의 기록 보기 →')),
            ])));
  }
}

class _MemoryCard extends StatefulWidget {
  const _MemoryCard({super.key, required this.memory});
  final SharedMemory memory;
  @override
  State<_MemoryCard> createState() => _MemoryCardState();
}

class _MemoryCardState extends State<_MemoryCard> {
  bool _open = false;
  @override
  Widget build(BuildContext context) {
    final memory = widget.memory;
    final ja = Localizations.localeOf(context).languageCode == 'ja';
    return Card(
        margin: const EdgeInsets.only(top: 16),
        clipBehavior: Clip.antiAlias,
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
              color: const Color(0xFFE7EEE5),
              padding: const EdgeInsets.all(22),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.wb_sunny_outlined,
                        size: 32, color: Color(0xFF60775C)),
                    const SizedBox(height: 20),
                    if (memory.date != null)
                      Text(DateFormat('yyyy.M.d').format(memory.date!),
                          style: const TextStyle(fontSize: 12)),
                    Text(memory.title,
                        style: const TextStyle(
                            fontSize: 23, fontWeight: FontWeight.bold)),
                    Text(memory.placeName ?? (ja ? '場所は未登録' : '장소 미등록')),
                    TextButton(
                        onPressed: () => context.push('/m/${memory.id}/plan'),
                        child: Text(ja ? '予定を見る →' : '모임 보기 →')),
                  ])),
          Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(memory.companions.join(' · ')),
                    ExpansionTile(
                        tilePadding: EdgeInsets.zero,
                        title: Text(ja ? 'ひとことを読んで、残す' : '추억 읽고 한 줄 남기기'),
                        onExpansionChanged: (open) =>
                            setState(() => _open = open),
                        children: [
                          if (_open) MemoryNotesPanel(meetupId: memory.id)
                        ]),
                  ])),
        ]));
  }
}
