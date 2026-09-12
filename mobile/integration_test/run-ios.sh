#!/bin/sh
set -eu
if [ "$#" -ne 1 ]; then
  echo 'Usage: sh integration_test/run-ios.sh <iOS simulator device id>'
  exit 1
fi
# The native Installations SDK validates the format even in emulator mode.
# This is deliberately NOT a real Google API key (A + 38 zeroes).
exec flutter test integration_test/social_flow_test.dart --reporter expanded -d "$1" \
  --dart-define=USE_FIREBASE_EMULATOR=true \
  --dart-define=FIREBASE_PROJECT_ID=demo-aimasho-e2e \
  --dart-define=FIREBASE_API_KEY=A00000000000000000000000000000000000000 \
  --dart-define=FIREBASE_APP_ID=1:123456789:ios:0123456789abcdef012345 \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID=123456789
