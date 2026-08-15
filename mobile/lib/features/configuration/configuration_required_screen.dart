import 'package:flutter/material.dart';

class ConfigurationRequiredScreen extends StatelessWidget {
  const ConfigurationRequiredScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('a',
                    style: TextStyle(
                        fontSize: 46,
                        color: Color(0xFFEC654B),
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 18),
                Text('Firebase 연결이 필요해요',
                    style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 10),
                const Text(
                    '프로젝트 키는 코드에 포함하지 않았어요. README의 Mobile Firebase 설정을 따라 --dart-define-from-file로 연결해주세요.',
                    textAlign: TextAlign.center),
              ]),
            ),
          ),
        ),
      );
}
