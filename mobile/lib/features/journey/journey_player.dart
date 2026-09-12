import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../models/meetup.dart';

class JourneyPlayer extends StatefulWidget {
  const JourneyPlayer(
      {super.key,
      required this.stops,
      this.height = 390,
      this.compact = false});

  final List<TravelTimelineStop> stops;
  final double height;
  final bool compact;

  @override
  State<JourneyPlayer> createState() => _JourneyPlayerState();
}

class _JourneyPlayerState extends State<JourneyPlayer>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = _buildController();
  }

  @override
  void didUpdateWidget(covariant JourneyPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.stops.length != widget.stops.length) {
      _controller.dispose();
      _controller = _buildController();
    }
  }

  AnimationController _buildController() {
    final seconds = math.max(4, widget.stops.length * 2);
    return AnimationController(
        vsync: this, duration: Duration(seconds: seconds))
      ..addListener(() {
        if (mounted) setState(() {});
      })
      ..addStatusListener((status) {
        if (status == AnimationStatus.completed && mounted) setState(() {});
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  int get _currentIndex {
    if (widget.stops.length < 2) return 0;
    return math.min(widget.stops.length - 1,
        (_controller.value * (widget.stops.length - 1)).round());
  }

  void _toggle() {
    if (widget.stops.length < 2) return;
    if (_controller.isAnimating) {
      _controller.stop();
    } else {
      if (_controller.isCompleted) _controller.value = 0;
      _controller.forward();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (widget.stops.isEmpty) {
      return Container(
          height: widget.compact ? 180 : 260,
          alignment: Alignment.center,
          decoration: BoxDecoration(
              color: const Color(0xFFF3F3E9),
              borderRadius: BorderRadius.circular(24)),
          child: const Padding(
              padding: EdgeInsets.all(24),
              child: Text('완료한 약속에 장소를 저장하면\n여기에 여행 기록이 생겨요.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AimashoColors.muted, height: 1.6))));
    }

    final stop = widget.stops[_currentIndex];
    return Semantics(
        label: '약속 장소 여행 재생기',
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(
              height: widget.height,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: const Color(0xFFD6DDD2))),
              child: Stack(children: [
                Positioned.fill(
                    child: CustomPaint(
                        painter: _JourneyMapPainter(
                            stops: widget.stops, progress: _controller.value))),
                Positioned(
                    top: 14,
                    left: 14,
                    right: 14,
                    child: Row(children: [
                      _MapBadge(
                          icon: Icons.route_rounded,
                          label: '${_currentIndex + 1}/${widget.stops.length}'),
                      const Spacer(),
                      const _MapBadge(
                          icon: Icons.lock_outline_rounded, label: '약속 기록')
                    ])),
                Positioned(
                    left: 14,
                    right: 14,
                    bottom: 14,
                    child: Material(
                        color: Colors.white.withOpacity(.94),
                        borderRadius: BorderRadius.circular(18),
                        child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () =>
                                context.push('/m/${stop.meetupId}/plan'),
                            child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(children: [
                                  Container(
                                      width: 42,
                                      height: 42,
                                      decoration: BoxDecoration(
                                          color: const Color(0xFFFFE3D2),
                                          borderRadius:
                                              BorderRadius.circular(14)),
                                      child: const Icon(Icons.place_rounded,
                                          color: AimashoColors.coral)),
                                  const SizedBox(width: 11),
                                  Expanded(
                                      child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                        Text(stop.place.name,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w900)),
                                        const SizedBox(height: 3),
                                        Text(
                                            '${DateFormat('yyyy.M.d').format(stop.visitedAt)} · ${stop.title}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                                color: AimashoColors.muted,
                                                fontSize: 11))
                                      ])),
                                  const Icon(Icons.chevron_right_rounded,
                                      color: AimashoColors.muted)
                                ])))))
              ])),
          const SizedBox(height: 10),
          Row(children: [
            IconButton.filled(
                tooltip: _controller.isAnimating ? '일시정지' : '재생',
                onPressed: widget.stops.length < 2 ? null : _toggle,
                icon: Icon(_controller.isAnimating
                    ? Icons.pause_rounded
                    : Icons.play_arrow_rounded)),
            Expanded(
                child: Slider(
                    value: _controller.value,
                    onChanged: widget.stops.length < 2
                        ? null
                        : (value) {
                            _controller.stop();
                            _controller.value = value;
                          })),
            SizedBox(
                width: 44,
                child: Text('${_currentIndex + 1}/${widget.stops.length}',
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                        color: AimashoColors.muted,
                        fontSize: 11,
                        fontWeight: FontWeight.w800)))
          ]),
          if (!widget.compact)
            const Padding(
                padding: EdgeInsets.only(left: 8, top: 2),
                child: Text('저장된 약속 장소를 날짜순으로 이어 보여줍니다. GPS 이동 경로는 기록하지 않아요.',
                    style: TextStyle(
                        color: AimashoColors.muted, fontSize: 10, height: 1.5)))
        ]));
  }
}

class _MapBadge extends StatelessWidget {
  const _MapBadge({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
          color: Colors.white.withOpacity(.9),
          borderRadius: BorderRadius.circular(999)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: AimashoColors.coral),
        const SizedBox(width: 5),
        Text(label,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900))
      ]));
}

class _JourneyMapPainter extends CustomPainter {
  const _JourneyMapPainter({required this.stops, required this.progress});
  final List<TravelTimelineStop> stops;
  final double progress;

  List<Offset> _points(Size size) {
    final lats = stops.map((item) => item.place.latitude).toList();
    final lngs = stops.map((item) => item.place.longitude).toList();
    var minLat = lats.reduce(math.min);
    var maxLat = lats.reduce(math.max);
    var minLng = lngs.reduce(math.min);
    var maxLng = lngs.reduce(math.max);
    if ((maxLat - minLat).abs() < .01) {
      minLat -= .01;
      maxLat += .01;
    }
    if ((maxLng - minLng).abs() < .01) {
      minLng -= .01;
      maxLng += .01;
    }
    const horizontalPadding = 42.0;
    const topPadding = 50.0;
    final bottomPadding = math.min(132.0, size.height * .38);
    final width = math.max(1.0, size.width - horizontalPadding * 2);
    final height = math.max(1.0, size.height - topPadding - bottomPadding);
    return stops.map((item) {
      final x = horizontalPadding +
          ((item.place.longitude - minLng) / (maxLng - minLng)) * width;
      final y = topPadding +
          (1 - (item.place.latitude - minLat) / (maxLat - minLat)) * height;
      return Offset(x, y);
    }).toList();
  }

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
        Offset.zero & size, Paint()..color = const Color(0xFFE8F2E1));
    final water = Paint()
      ..color = const Color(0xFFCFE8EC)
      ..style = PaintingStyle.fill;
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(size.width * .15, size.height * .18),
            width: size.width * .58,
            height: size.height * .3),
        water);
    canvas.drawOval(
        Rect.fromCenter(
            center: Offset(size.width * .9, size.height * .65),
            width: size.width * .65,
            height: size.height * .38),
        water);

    final road = Paint()
      ..color = Colors.white.withOpacity(.72)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;
    for (var index = 0; index < 5; index += 1) {
      final y = size.height * (.15 + index * .16);
      final path = Path()
        ..moveTo(-20, y)
        ..cubicTo(size.width * .25, y - 32, size.width * .7, y + 28,
            size.width + 20, y - 8);
      canvas.drawPath(path, road);
    }
    final crossRoad = Paint()
      ..color = const Color(0xFFD5DECB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    for (var index = 0; index < 6; index += 1) {
      final x = size.width * (.08 + index * .19);
      canvas.drawLine(Offset(x, 0), Offset(x + 34, size.height), crossRoad);
    }

    final points = _points(size);
    if (points.isEmpty) return;
    final fullPath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final point in points.skip(1)) {
      fullPath.lineTo(point.dx, point.dy);
    }
    canvas.drawPath(
        fullPath,
        Paint()
          ..color = const Color(0xFFFFFFFF).withOpacity(.82)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 8
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);
    canvas.drawPath(
        fullPath,
        Paint()
          ..color = const Color(0xFFE1A88F)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);

    final scaled = points.length < 2 ? 0.0 : progress * (points.length - 1);
    final segment = math.min(points.length - 1, scaled.floor());
    final fraction = scaled - segment;
    final activePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (var index = 1; index <= segment; index += 1) {
      activePath.lineTo(points[index].dx, points[index].dy);
    }
    var marker = points.first;
    if (points.length > 1) {
      if (segment >= points.length - 1) {
        marker = points.last;
      } else {
        marker = Offset.lerp(points[segment], points[segment + 1], fraction)!;
        activePath.lineTo(marker.dx, marker.dy);
      }
    }
    canvas.drawPath(
        activePath,
        Paint()
          ..color = AimashoColors.coral
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);

    for (var index = 0; index < points.length; index += 1) {
      canvas.drawCircle(
          points[index],
          8,
          Paint()
            ..color = index <= segment ? AimashoColors.coral : Colors.white);
      canvas.drawCircle(
          points[index],
          8,
          Paint()
            ..color = AimashoColors.coral
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2);
    }
    canvas.drawCircle(
        marker, 17, Paint()..color = Colors.white.withOpacity(.9));
    canvas.drawCircle(marker, 11, Paint()..color = AimashoColors.coral);
    canvas.drawCircle(marker, 4, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(covariant _JourneyMapPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.stops != stops;
}
