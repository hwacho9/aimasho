import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 26, 24, 24),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: [
                    const DecoratedBox(
                        decoration: BoxDecoration(
                            color: AimashoColors.coral,
                            borderRadius: BorderRadius.only(
                                topLeft: Radius.circular(10),
                                topRight: Radius.circular(10),
                                bottomRight: Radius.circular(10),
                                bottomLeft: Radius.circular(3))),
                        child: SizedBox(
                            width: 30,
                            height: 30,
                            child: Center(
                                child: Text('a',
                                    style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 20,
                                        fontWeight: FontWeight.w800,
                                        fontStyle: FontStyle.italic))))),
                    const SizedBox(width: 8),
                    const Text('aimasho',
                        style: TextStyle(
                            fontSize: 21, fontWeight: FontWeight.w800)),
                    const Spacer(),
                    IconButton(
                        onPressed: () => context.push('/profile'),
                        icon: const Icon(Icons.person_outline_rounded)),
                  ]),
                  const Spacer(),
                  const Center(child: _SunMark()),
                  const SizedBox(height: 27),
                  const Text('みんなの\n「いつ・どこ・何時に出る？」\nを、ひとつに。',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 30,
                          height: 1.45,
                          letterSpacing: -1.4,
                          fontWeight: FontWeight.w500)),
                  const SizedBox(height: 18),
                  const Text('日程を合わせて、場所を決めて、\nちゃんと会えるところまで。',
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(color: AimashoColors.muted, height: 1.7)),
                  const SizedBox(height: 34),
                  ElevatedButton.icon(
                      onPressed: () => context.push('/new'),
                      icon: const Icon(Icons.add_rounded),
                      label: const Text('약속 만들기')),
                  const SizedBox(height: 14),
                  const Text('로그인 없이도 바로 시작할 수 있어요',
                      textAlign: TextAlign.center,
                      style:
                          TextStyle(fontSize: 12, color: AimashoColors.muted)),
                  const Spacer(),
                  const Padding(
                      padding: EdgeInsets.only(top: 18),
                      child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text('いつ会う？',
                                style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w700)),
                            Padding(
                                padding: EdgeInsets.symmetric(horizontal: 10),
                                child: Text('→',
                                    style:
                                        TextStyle(color: AimashoColors.coral))),
                            Text('どこで会う？',
                                style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w700)),
                            Padding(
                                padding: EdgeInsets.symmetric(horizontal: 10),
                                child: Text('→',
                                    style:
                                        TextStyle(color: AimashoColors.coral))),
                            Text('何時に出る？',
                                style: TextStyle(
                                    fontSize: 12, fontWeight: FontWeight.w700))
                          ])),
                ]),
          ),
        ),
      );
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
