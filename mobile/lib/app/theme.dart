import 'package:flutter/material.dart';

abstract final class AimashoColors {
  static const coral = Color(0xFFEC654B);
  static const coralDark = Color(0xFFCF4C35);
  static const paper = Color(0xFFFFFAF4);
  static const ink = Color(0xFF302725);
  static const muted = Color(0xFF756B65);
  static const line = Color(0xFFEADFD6);
  static const green = Color(0xFF3EAA70);
  static const yellow = Color(0xFFE8A832);
  static const red = Color(0xFFDD6659);
}

ThemeData aimashoTheme() {
  final scheme = ColorScheme.fromSeed(
      seedColor: AimashoColors.coral,
      brightness: Brightness.light,
      surface: AimashoColors.paper);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme.copyWith(
        primary: AimashoColors.coral,
        onPrimary: Colors.white,
        surface: AimashoColors.paper,
        onSurface: AimashoColors.ink),
    scaffoldBackgroundColor: AimashoColors.paper,
    appBarTheme: const AppBarTheme(
        backgroundColor: AimashoColors.paper,
        foregroundColor: AimashoColors.ink,
        elevation: 0,
        centerTitle: true),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFFFFEFB),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AimashoColors.line)),
      enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AimashoColors.line)),
      focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AimashoColors.coral, width: 2)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
            backgroundColor: AimashoColors.coral,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(54),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            textStyle: const TextStyle(fontWeight: FontWeight.w800))),
  );
}
