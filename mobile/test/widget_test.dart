import 'package:aimasho/app/aimasho_app.dart';
import 'package:aimasho/services/firebase_bootstrap.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows Firebase setup guidance until a project is connected',
      (tester) async {
    await tester.pumpWidget(
      // Provider override construction cannot be const.
      // ignore: prefer_const_constructors
      ProviderScope(
        overrides: [firebaseReadyProvider.overrideWithValue(false)],
        child: const AimashoApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Firebase 연결이 필요해요'), findsOneWidget);
  });
}
