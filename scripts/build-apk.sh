#!/usr/bin/env bash
# Builds the Android APK for the Capacitor shell.
#
# Two things bite here and neither is obvious from the error message:
#
#   1. Capacitor 8 compiles with source release 21. With Java 17 on PATH the
#      build fails with "invalid source release: 21" from a Java compilation
#      initialization error, which never mentions Java versions at all.
#   2. ANDROID_HOME must point at the SDK. Homebrew installs the command-line
#      tools at /opt/homebrew/share/android-commandlinetools, not the
#      ~/Library/Android/sdk path the Android Studio docs assume.
#
# Usage:  ./scripts/build-apk.sh [debug|release]
set -euo pipefail

VARIANT="${1:-debug}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for candidate in \
  "${JAVA_HOME:-}" \
  /opt/homebrew/opt/openjdk@21 \
  /usr/local/opt/openjdk@21 \
  /Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home
do
  if [ -n "$candidate" ] && [ -x "$candidate/bin/javac" ]; then
    export JAVA_HOME="$candidate"
    break
  fi
done
export PATH="$JAVA_HOME/bin:$PATH"

JAVA_MAJOR="$(javac -version 2>&1 | sed -E 's/javac ([0-9]+).*/\1/')"
if [ "$JAVA_MAJOR" -lt 21 ]; then
  echo "ERROR: Capacitor 8 needs JDK 21+, found $JAVA_MAJOR (JAVA_HOME=$JAVA_HOME)" >&2
  echo "       brew install openjdk@21" >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  for sdk in /opt/homebrew/share/android-commandlinetools "$HOME/Library/Android/sdk"; do
    if [ -d "$sdk" ]; then export ANDROID_HOME="$sdk"; break; fi
  done
fi
if [ -z "${ANDROID_HOME:-}" ]; then
  echo "ERROR: Android SDK not found. Set ANDROID_HOME or: brew install android-commandlinetools" >&2
  exit 1
fi
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "JDK         : $(javac -version 2>&1)"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "Variant     : $VARIANT"

cd "$ROOT/android"
case "$VARIANT" in
  debug)   ./gradlew assembleDebug ;;
  release) ./gradlew assembleRelease ;;
  *) echo "Unknown variant: $VARIANT (use debug or release)" >&2; exit 1 ;;
esac

APK="$(find "$ROOT/android/app/build/outputs/apk/$VARIANT" -name '*.apk' | head -1)"
echo
echo "APK: $APK"
ls -la "$APK" | awk '{printf "     %.1f MB\n", $5/1048576}'
