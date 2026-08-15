// ignore_for_file: curly_braces_in_flow_control_structures

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';
import '../../providers/meetup_providers.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});
  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _loading = true;
  bool _busy = false;
  bool _anonymous = true;
  String _name = '';
  List<Room> _rooms = [];
  final _roomName = TextEditingController();
  final _invite = TextEditingController();
  final _originQuery = TextEditingController();
  List<Location> _originResults = [];
  Location? _defaultOrigin;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _roomName.dispose();
    _invite.dispose();
    _originQuery.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final user =
          await ref.read(meetupRepositoryProvider).ensureAnonymousUser();
      _name = user.displayName ?? '';
      _anonymous = user.isAnonymous;
      if (!_anonymous)
        _rooms = await ref.read(meetupRepositoryProvider).myRooms();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('프로필을 불러오지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _upgrade() async {
    setState(() => _busy = true);
    try {
      final user =
          await ref.read(meetupRepositoryProvider).continueWithGoogle();
      await ref.read(meetupRepositoryProvider).saveProfile(
          user.displayName ?? (_name.isNotEmpty ? _name : 'aimasho user'));
      await _load();
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Google 연결을 완료하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _create() async {
    if (_roomName.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final room = await ref.read(meetupRepositoryProvider).createRoom(
          _roomName.text.trim(), _name.isNotEmpty ? _name : 'aimasho user');
      if (mounted) context.push('/rooms/${room.id}');
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Room을 만들지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    if (_invite.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final roomId = await ref.read(meetupRepositoryProvider).joinRoom(
          _invite.text.trim(), _name.isNotEmpty ? _name : 'aimasho user');
      if (mounted) context.push('/rooms/$roomId');
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Room에 참여하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _searchOrigin() async {
    if (_originQuery.text.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      _originResults = await ref
          .read(meetupRepositoryProvider)
          .searchPlaces(_originQuery.text.trim());
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('장소를 찾지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _saveOrigin(Location origin) async {
    setState(() => _busy = true);
    try {
      await ref.read(meetupRepositoryProvider).saveDefaultOrigin(origin);
      if (mounted)
        setState(() {
          _defaultOrigin = origin;
          _originResults = [];
        });
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('기본 출발 위치를 저장하지 못했어요: $error')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(
          title: const Text('내 계정',
              style: TextStyle(fontWeight: FontWeight.w800))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(24), children: [
              const Text('MY AIMASHO',
                  style: TextStyle(
                      fontSize: 11,
                      color: AimashoColors.coral,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w800)),
              const SizedBox(height: 5),
              Text('${_name.isEmpty ? '내' : _name}의 약속',
                  style: Theme.of(context)
                      .textTheme
                      .headlineMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              if (_anonymous)
                Container(
                    margin: const EdgeInsets.only(top: 22),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                        color: const Color(0xFFFFF0E8),
                        borderRadius: BorderRadius.circular(20)),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('약속을 계속 저장할까요?',
                              style: TextStyle(
                                  fontWeight: FontWeight.w800, fontSize: 18)),
                          const SizedBox(height: 8),
                          const Text(
                              'Google로 연결하면 Room을 만들고 여러 기기에서 약속을 확인할 수 있어요.',
                              style: TextStyle(
                                  color: AimashoColors.muted,
                                  fontSize: 12,
                                  height: 1.6)),
                          const SizedBox(height: 16),
                          ElevatedButton(
                              onPressed: _busy ? null : _upgrade,
                              child: Text(_busy ? '연결 중...' : 'Google로 계속하기'))
                        ]))
              else ...[
                const SizedBox(height: 26),
                const Text('DEFAULT ORIGIN',
                    style: TextStyle(
                        fontSize: 11,
                        color: AimashoColors.coral,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('기본 출발 위치',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                if (_defaultOrigin != null)
                  Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text('✓ ${_defaultOrigin!.name}',
                          style: const TextStyle(
                              color: Color(0xFF397D58),
                              fontWeight: FontWeight.w700)))
                else
                  const Padding(
                      padding: EdgeInsets.only(top: 7),
                      child: Text('자주 출발하는 장소를 저장해두세요.',
                          style: TextStyle(
                              color: AimashoColors.muted, fontSize: 12))),
                const SizedBox(height: 9),
                Row(children: [
                  Expanded(
                      child: TextField(
                          controller: _originQuery,
                          decoration: const InputDecoration(
                              hintText: '역 / 장소 검색', isDense: true))),
                  const SizedBox(width: 8),
                  OutlinedButton(
                      onPressed: _busy ? null : _searchOrigin,
                      child: const Text('검색'))
                ]),
                ..._originResults.map((origin) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(origin.name),
                    subtitle: Text(origin.address ?? ''),
                    onTap: () => _saveOrigin(origin))),
                const SizedBox(height: 24),
                const Text('MY ROOMS',
                    style: TextStyle(
                        fontSize: 11,
                        color: AimashoColors.coral,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                Text('내 모임',
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 10),
                if (_rooms.isEmpty)
                  const Text('아직 Room이 없어요. 첫 모임을 만들어보세요.',
                      style: TextStyle(color: AimashoColors.muted))
                else
                  ..._rooms.map((room) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                          backgroundColor: Color(0xFFFFE5D6),
                          child: Text('👥')),
                      title: Text(room.name,
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text(room.role == 'OWNER' ? '관리자' : '멤버'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/rooms/${room.id}'))),
                const SizedBox(height: 12),
                TextField(
                    controller: _roomName,
                    decoration: const InputDecoration(
                        hintText: '새 Room 이름', isDense: true)),
                const SizedBox(height: 8),
                OutlinedButton(
                    onPressed: _busy ? null : _create,
                    child: const Text('+ 새 모임')),
                const SizedBox(height: 12),
                TextField(
                    controller: _invite,
                    decoration: const InputDecoration(
                        hintText: '초대 코드', isDense: true)),
                const SizedBox(height: 8),
                OutlinedButton(
                    onPressed: _busy ? null : _join,
                    child: const Text('Room 참여하기'))
              ]
            ]));
}
