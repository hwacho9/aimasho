import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';

import 'firebase_bootstrap.dart';

/// Product behavior only: never pass names, titles, locations, IDs, or amounts.
abstract final class AppAnalytics {
  static void log(String name) {
    if (!FirebaseBootstrap.isConfigured) return;
    unawaited(_log(name));
  }

  static Future<void> _log(String name) async {
    try {
      await FirebaseAnalytics.instance.logEvent(name: name);
    } catch (_) {
      // Measurement must never block a user action.
    }
  }
}
