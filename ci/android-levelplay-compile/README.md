# LevelPlay Kotlin compile-only harness

This is a deliberately isolated Android *library* compile. It copies
\`LevelPlayBannerHost.kt\` and \`LevelPlaySdkBannerDraft.kt\` from the
**Draft PR** into this temporary Gradle project in GitHub Actions and compiles
them against the real \`com.unity3d.ads-mediation:mediation-sdk:9.5.0\` AAR.

Safety: no Android APK, Tauri initialization, LevelPlay network request,
ad impression, Google Play release, signing key, publisher app key or ad unit
ID is used. A passing result **does not prove** that the real Tauri activity
layout, native banner placement or Android device behavior works.

Build on an Android-capable machine with the Android SDK 36 installed:

\`\`\`bash
mkdir -p ci/android-levelplay-compile/src/main/java/org/appsandgames/datelottogenerator
cp src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/LevelPlayBannerHost.kt ci/android-levelplay-compile/src/main/java/org/appsandgames/datelottogenerator/
cp src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/LevelPlaySdkBannerDraft.kt ci/android-levelplay-compile/src/main/java/org/appsandgames/datelottogenerator/
bash src-tauri/gen/android/gradlew -p ci/android-levelplay-compile --no-daemon compileDebugKotlin
\`\`\`

The \`src/main/java\` directory generated for compiling is intentionally not
committed. Normal Tauri application builds exclude the LevelPlay SDK unless
a separate explicit opt-in is supplied, and the Kotlin draft also has
\`APPROVED_AD_REQUESTS=false\` as a second hard stop.
