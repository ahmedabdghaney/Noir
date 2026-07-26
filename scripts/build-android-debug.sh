#!/bin/sh

set -eu

if [ -z "${JAVA_HOME:-}" ]; then
  for noir_java_home in \
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home" \
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  do
    if [ -d "$noir_java_home" ]; then
      JAVA_HOME="$noir_java_home"
      export JAVA_HOME
      break
    fi
  done
fi

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "Java 21 was not found. Install it or set JAVA_HOME before building." >&2
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  for noir_android_home in \
    "/opt/homebrew/share/android-commandlinetools" \
    "${HOME}/Library/Android/sdk"
  do
    if [ -d "$noir_android_home/platforms/android-36" ]; then
      ANDROID_HOME="$noir_android_home"
      export ANDROID_HOME
      break
    fi
  done
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  echo "Android SDK 36 was not found. Install it or set ANDROID_HOME before building." >&2
  exit 1
fi

ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export ANDROID_SDK_ROOT PATH

npm run android:sync

(
  cd android
  ./gradlew assembleDebug
)

echo "APK ready: android/app/build/outputs/apk/debug/app-debug.apk"
