import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../providers/meetup_providers.dart';
import 'journey_player.dart';

const _journeyEyebrowStyle = TextStyle(
    color: AimashoColors.coral,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: FontWeight.w800);

class JourneyScreen extends ConsumerWidget {
  const JourneyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final timeline = ref.watch(travelTimelineProvider);
    return Scaffold(
        appBar: AppBar(
            title: const Text('나의 Journey',
                style: TextStyle(fontWeight: FontWeight.w900))),
        body: timeline.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => Center(
                child: Padding(
                    padding: const EdgeInsets.all(28),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.map_outlined,
                          size: 42, color: AimashoColors.coral),
                      const SizedBox(height: 12),
                      const Text('여행 기록을 불러오지 못했어요.',
                          style: TextStyle(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      Text('$error',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                              color: AimashoColors.muted, fontSize: 11)),
                      const SizedBox(height: 14),
                      OutlinedButton(
                          onPressed: () =>
                              ref.invalidate(travelTimelineProvider),
                          child: const Text('다시 불러오기'))
                    ]))),
            data: (data) => ListView(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 44),
                    children: [
                      const Text('MY AIMASHO JOURNEY',
                          style: _journeyEyebrowStyle),
                      const SizedBox(height: 6),
                      Text('함께한 날을 지도로 다시 만나보세요',
                          style: Theme.of(context)
                              .textTheme
                              .headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w900)),
                      const SizedBox(height: 8),
                      const Text('완료한 약속의 장소를 시간순으로 이어서 영상처럼 재생합니다.',
                          style: TextStyle(
                              color: AimashoColors.muted, height: 1.55)),
                      const SizedBox(height: 18),
                      Row(children: [
                        Expanded(
                            child: _Summary(
                                value: data.summary.completedMeetupCount,
                                label: '함께한 약속')),
                        const SizedBox(width: 9),
                        Expanded(
                            child: _Summary(
                                value: data.summary.uniquePlaceCount,
                                label: '방문 장소')),
                        const SizedBox(width: 9),
                        Expanded(
                            child: _Summary(
                                value: data.summary.totalStops,
                                label: '여정 포인트'))
                      ]),
                      const SizedBox(height: 18),
                      JourneyPlayer(stops: data.stops)
                    ])));
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.value, required this.label});
  final int value;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 13),
      decoration: BoxDecoration(
          color: const Color(0xFFFFF0E6),
          borderRadius: BorderRadius.circular(17)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$value',
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
        const SizedBox(height: 2),
        Text(label,
            style: const TextStyle(
                color: AimashoColors.muted,
                fontSize: 10,
                fontWeight: FontWeight.w700))
      ]));
}
