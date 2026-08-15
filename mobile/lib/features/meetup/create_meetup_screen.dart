import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../providers/meetup_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class CreateMeetupScreen extends ConsumerStatefulWidget {
  const CreateMeetupScreen({super.key, this.roomId});
  final String? roomId;
  @override
  ConsumerState<CreateMeetupScreen> createState() => _CreateMeetupScreenState();
}

class _CreateMeetupScreenState extends ConsumerState<CreateMeetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _title = TextEditingController(text: '大学の友だちと夜ごはん');
  final _description = TextEditingController();
  int _duration = 120;
  bool _saving = false;
  final List<DateTime> _slots = [
    DateTime(2026, 8, 21, 19),
    DateTime(2026, 8, 22, 18),
    DateTime(2026, 8, 22, 19),
    DateTime(2026, 8, 23, 18)
  ];

  @override
  void dispose() {
    _name.dispose();
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickSlot(int index) async {
    final current = _slots[index];
    final date = await showDatePicker(
        context: context,
        initialDate: current,
        firstDate: DateTime.now().subtract(const Duration(days: 1)),
        lastDate: DateTime.now().add(const Duration(days: 365)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(
        context: context, initialTime: TimeOfDay.fromDateTime(current));
    if (time == null) return;
    setState(() => _slots[index] =
        DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final meetupId = await ref.read(meetupRepositoryProvider).createMeetup(
          hostName: _name.text.trim(),
          title: _title.text.trim(),
          description: _description.text.trim(),
          durationMinutes: _duration,
          candidateSlots: _slots,
          roomId: widget.roomId);
      if (mounted) context.go('/m/$meetupId/plan');
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('약속을 만들지 못했어요: $error')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const Text('새 약속',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
        body: SafeArea(
          top: false,
          child: Form(
            key: _formKey,
            child: ListView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 36),
                children: [
                  if (widget.roomId != null)
                    const Padding(
                        padding: EdgeInsets.only(bottom: 18),
                        child: Text('이 Room의 멤버가 자동으로 약속에 참여해요.',
                            style: TextStyle(
                                fontSize: 12, color: AimashoColors.coral))),
                  const Text('LET\'S GET TOGETHER',
                      style: TextStyle(
                          fontSize: 11,
                          color: AimashoColors.coral,
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text('언제 만날까요?',
                      style: Theme.of(context)
                          .textTheme
                          .headlineMedium
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  const Text('후보 날짜를 몇 개 골라주세요.\n친구들이 편한 시간을 알려줄 거예요.',
                      style:
                          TextStyle(color: AimashoColors.muted, height: 1.7)),
                  const SizedBox(height: 28),
                  _Input(label: '내 이름', controller: _name, hint: '예: 성화'),
                  _Input(
                      label: '약속 이름',
                      controller: _title,
                      hint: '예: 大学の友だちと夜ごはん'),
                  _Input(
                      label: '한마디 (선택)',
                      controller: _description,
                      hint: '무엇을 할까요?',
                      maxLines: 3,
                      required: false),
                  const Text('예상 약속 시간',
                      style:
                          TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<int>(
                      value: _duration,
                      items: const [
                        DropdownMenuItem(value: 60, child: Text('1시간')),
                        DropdownMenuItem(value: 90, child: Text('1시간 30분')),
                        DropdownMenuItem(value: 120, child: Text('2시간')),
                        DropdownMenuItem(value: 180, child: Text('3시간'))
                      ],
                      onChanged: (value) => setState(() => _duration = value!)),
                  const SizedBox(height: 28),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('후보 날짜와 시간',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        Text('${_slots.length}/12',
                            style: const TextStyle(
                                color: AimashoColors.muted, fontSize: 12))
                      ]),
                  const SizedBox(height: 10),
                  for (var index = 0; index < _slots.length; index++)
                    _SlotPicker(
                        index: index + 1,
                        dateTime: _slots[index],
                        onTap: () => _pickSlot(index),
                        onRemove: _slots.length > 1
                            ? () => setState(() => _slots.removeAt(index))
                            : null),
                  if (_slots.length < 12)
                    TextButton.icon(
                        onPressed: () => setState(() => _slots
                            .add(_slots.last.add(const Duration(days: 1)))),
                        icon: const Icon(Icons.add),
                        label: const Text('후보 추가')),
                  const SizedBox(height: 18),
                  ElevatedButton(
                      onPressed: _saving ? null : _submit,
                      child: Text(_saving ? '만드는 중...' : '약속 만들기')),
                ]),
          ),
        ),
      );
}

class _Input extends StatelessWidget {
  const _Input(
      {required this.label,
      required this.controller,
      required this.hint,
      this.maxLines = 1,
      this.required = true});
  final String label;
  final TextEditingController controller;
  final String hint;
  final int maxLines;
  final bool required;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        TextFormField(
            controller: controller,
            maxLength: label == '한마디 (선택)' ? 500 : 80,
            maxLines: maxLines,
            decoration: InputDecoration(hintText: hint, counterText: ''),
            validator: required
                ? (value) =>
                    value == null || value.trim().isEmpty ? '입력해주세요.' : null
                : null)
      ]));
}

class _SlotPicker extends StatelessWidget {
  const _SlotPicker(
      {required this.index,
      required this.dateTime,
      required this.onTap,
      this.onRemove});
  final int index;
  final DateTime dateTime;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  @override
  Widget build(BuildContext context) {
    final text = MaterialLocalizations.of(context).formatMediumDate(dateTime);
    final time = MaterialLocalizations.of(context)
        .formatTimeOfDay(TimeOfDay.fromDateTime(dateTime));
    return Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Row(children: [
          Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                  color: const Color(0xFFF8E9DF),
                  borderRadius: BorderRadius.circular(8)),
              child: Text('$index',
                  style: const TextStyle(
                      fontSize: 12,
                      color: AimashoColors.coral,
                      fontWeight: FontWeight.w800))),
          const SizedBox(width: 9),
          Expanded(
              child: OutlinedButton.icon(
                  onPressed: onTap,
                  icon: const Icon(Icons.calendar_today_rounded, size: 16),
                  label: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('$text  $time')),
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 51),
                      foregroundColor: AimashoColors.ink,
                      side: const BorderSide(color: AimashoColors.line),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(13))))),
          if (onRemove != null)
            IconButton(
                onPressed: onRemove,
                icon:
                    const Icon(Icons.close_rounded, color: AimashoColors.muted))
        ]));
  }
}
