import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/social.dart';
import '../../providers/meetup_providers.dart';

class MemoryNotesPanel extends ConsumerStatefulWidget {
  const MemoryNotesPanel({super.key, required this.meetupId});
  final String meetupId;
  @override
  ConsumerState<MemoryNotesPanel> createState() => _MemoryNotesPanelState();
}

class _MemoryNotesPanelState extends ConsumerState<MemoryNotesPanel> {
  final _draft = TextEditingController();
  List<MemoryNote>? _notes;
  bool _busy = false;
  bool _failed = false;
  bool _saved = false;
  String t(String ko, String ja) =>
      Localizations.localeOf(context).languageCode == 'ja' ? ja : ko;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final notes =
          await ref.read(meetupRepositoryProvider).memoryNotes(widget.meetupId);
      if (!mounted) return;
      final uid = ref.read(authUserProvider).valueOrNull?.uid;
      final own = notes.where((note) => note.uid == uid);
      setState(() {
        _notes = notes;
        _draft.text = own.isEmpty ? '' : own.first.body;
        _failed = false;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  Future<void> _save({bool remove = false}) async {
    if (remove) {
      final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
                  title: Text(t('내 추억 글을 삭제할까요?', '自分のひとことを削除しますか？')),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: Text(t('취소', 'キャンセル'))),
                    TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: Text(t('삭제', '削除')))
                  ]));
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      _busy = true;
      _failed = false;
      _saved = false;
    });
    try {
      final repo = ref.read(meetupRepositoryProvider);
      if (remove) {
        await repo.deleteMemory(widget.meetupId);
      } else {
        await repo.saveMemory(widget.meetupId, _draft.text);
      }
      await _load();
      if (mounted && !_failed) setState(() => _saved = true);
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authUserProvider).valueOrNull;
    final own = _notes?.any((note) => note.uid == user?.uid) ?? false;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(
          t('이 모임 참가자에게만 공유돼요. 공개 피드나 위치 추적이 아니에요.',
              'この予定の参加者だけに共有されます。公開フィードや位置追跡ではありません。'),
          style: const TextStyle(fontSize: 12)),
      if (_notes == null && !_failed)
        const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator())),
      ...?_notes?.map((note) => Card(
          child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(note.displayName,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Text(note.body)
                  ])))),
      if (user != null && !user.isAnonymous && _notes != null) ...[
        const SizedBox(height: 12),
        TextField(
            controller: _draft,
            maxLength: 280,
            minLines: 2,
            maxLines: 5,
            enabled: !_busy,
            onChanged: (_) => setState(() => _saved = false),
            decoration: InputDecoration(labelText: t('그날의 한 줄', 'あの日のひとこと'))),
        Wrap(spacing: 10, children: [
          FilledButton(
              onPressed:
                  _busy || _draft.text.trim().isEmpty ? null : () => _save(),
              child: Text(_busy
                  ? t('저장 중…', '保存中…')
                  : own
                      ? t('수정 저장', '変更を保存')
                      : t('추억 남기기', '思い出を残す'))),
          if (own)
            TextButton(
                onPressed: _busy ? null : () => _save(remove: true),
                child: Text(t('내 글 삭제', '自分の投稿を削除')))
        ]),
      ] else if (user == null || user.isAnonymous)
        TextButton(
            onPressed: () => context.push('/profile'),
            child: Text(t('로그인하고 추억 남기기', 'ログインして思い出を残す'))),
      if (_saved) Text(t('반영했어요.', '反映しました。')),
      if (_failed) ...[
        Text(t('추억을 불러오거나 저장하지 못했어요. 입력한 글은 그대로예요.',
            '読み込み・保存に失敗しました。入力した文章は残っています。')),
        if (_notes == null)
          TextButton(onPressed: _load, child: Text(t('다시 시도', '再試行')))
      ],
    ]);
  }
}
