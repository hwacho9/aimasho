import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final firebaseReadyProvider = Provider<bool>((_) => throw UnimplementedError());

/// Configure each value with --dart-define or --dart-define-from-file.
/// Keeping secrets out of source lets one Firebase project serve iOS and Android.
abstract final class FirebaseBootstrap {
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _authDomain = String.fromEnvironment('FIREBASE_AUTH_DOMAIN');
  static const _storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');
  static const _useEmulator = bool.fromEnvironment('USE_FIREBASE_EMULATOR');

  static bool get isConfigured => [
        _apiKey,
        _appId,
        _messagingSenderId,
        _projectId
      ].every((value) => value.isNotEmpty);

  static Future<bool> initialize() async {
    if (!isConfigured) return false;
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: _apiKey,
            appId: _appId,
            messagingSenderId: _messagingSenderId,
            projectId: _projectId,
            authDomain: _authDomain.isEmpty ? null : _authDomain,
            storageBucket: _storageBucket.isEmpty ? null : _storageBucket));
    if (_useEmulator) {
      await FirebaseAuth.instance.useAuthEmulator('127.0.0.1', 9099);
    }
    return true;
  }
}
