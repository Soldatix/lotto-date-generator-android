import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const gradle = read('src-tauri/gen/android/app/build.gradle.kts');
const main = read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const sdk = read('src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/LevelPlaySdkBannerDraft.kt');
const host = read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/LevelPlayBannerHost.kt');

test('Gradle production builds exclude LevelPlay SDK and opt-in sources', () => {
  assert.match(gradle, /val levelPlaySdkPilot = providers\.gradleProperty\("appsGamesLevelPlaySdkPilot"\)/);
  assert.match(gradle, /orNull\?\.equals\("true", ignoreCase = true\) == true/);
  assert.match(gradle, /levelPlaySdkPilot && gradle\.startParameter\.taskNames\.any/);
  assert.match(gradle, /LEVELPLAY_PRODUCTION_NO_GO/);
  assert.match(gradle, /if \(levelPlaySdkPilot\) \{\s*sourceSets\.getByName\("main"\)\.java\.srcDir\("src\/levelplayPilot\/java"\)/);
  assert.match(gradle, /if \(levelPlaySdkPilot\) \{\s*implementation\("com\.unity3d\.ads-mediation:mediation-sdk:9\.5\.0"\)/);
});
test('SDK Kotlin implementation is dormant behind a separate hard stop', () => {
  assert.match(sdk, /private const val APPROVED_AD_REQUESTS = false/);
  assert.match(sdk, /if \(!APPROVED_AD_REQUESTS \|\| !consentGranted/);
  assert.match(sdk, /LevelPlayPrivacySettings\.setGDPRConsent\(true\)/);
  assert.match(sdk, /LevelPlay\.init\(activity, request,/);
  assert.match(sdk, /LevelPlayBannerAdView\(activity, adUnitId, config\)/);
  assert.match(sdk, /LevelPlayAdSize\.BANNER/);
  assert.match(sdk, /view\.loadAd\(\)/);
  assert.match(sdk, /banner\?\.destroy\(\)/);
  assert.doesNotMatch(main, /LevelPlaySdkBannerDraft|reserveBottomStripAfterReview|startAfterVerifiedConsent/);
});
test('Native host is non-overlapping and never installed automatically', () => {
  assert.match(host, /class LevelPlayBannerHost/);
  assert.match(host, /fun reserveBottomStripAfterReview/);
  assert.match(host, /content\.childCount != 1/);
  assert.match(host, /column\.addView\(\s*webRoot/);
  assert.match(host, /bannerSpace,\s*LinearLayout\.LayoutParams/);
  assert.match(host, /visibility = View\.GONE/);
  assert.doesNotMatch(host, /LevelPlay\.init|\.loadAd\(/);
});
test('Web preview remains independent of native real-ad authorization', () => {
  const mock=read('src/js/levelplay-pilot.js');
  assert.match(mock,/params\.get\('levelPlayPreview'\) !== '1'/);
  assert.doesNotMatch(mock,/startAfterVerifiedConsent|LevelPlay\.init|fetch\(/);
  assert.doesNotMatch(sdk,/294760d25|vu3eqmvs1u5vo6wi/); // no publisher dashboard IDs committed
  assert.doesNotMatch(gradle,/294760d25|vu3eqmvs1u5vo6wi/);
});


test('Windows read-only preflight cannot abort on normal ADB daemon startup stderr', () => {
  const script = read('scripts/LevelPlay-Android-Preflight-ReadOnly.ps1');
  assert.match(script, /function Invoke-NativeInfo/);
  assert.match(script, /RedirectStandardError = \$true/);
  assert.match(script, /RedirectStandardOutput = \$true/);
  assert.match(script, /WaitForExit\(15000\)/);
  assert.match(script, /Invoke-NativeInfo -exe \$adb -arguments 'devices'/);
  assert.doesNotMatch(script, /& \$adb devices/);
  assert.match(script, /UNAUTHORIZED_ADB_DEVICE_COUNT/);
  assert.match(script, /JAVA_HOME/);
  assert.match(script, /Android\\Android Studio\\jbr\\bin\\java.exe/);
  assert.match(script, /PRIVATE_IDS_NOT_PRINTED=TRUE/);
  assert.match(script, /NO_SOURCE_CHANGES=TRUE; PRODUCTION_NO_GO=TRUE/);
  assert.match(script, /RUST_TARGET_AARCH64_LINUX_ANDROID_INSTALLED/);
  assert.match(script, /ANDROID_NDK_FOUND/);
  assert.match(script, /ANDROID_CMDLINE_TOOLS_FOUND/);
  assert.match(script, /APP_COMPILE_SDK/);
  assert.match(script, /ANDROID_API_37_0_FOLDER_FOUND/);
  assert.match(script, /ANDROID_API_37_0_ANDROID_JAR_FOUND/);
  assert.match(script, /ANDROID_API_37_INSTALLED/);
  assert.match(script, /AGP_COMPILE_SDK_37_RESOLUTION=NOT_YET_VERIFIED/);
  assert.match(script, /platforms\\android-37\.0/);
  assert.match(script, /ANDROID_DEBUG_APK_NOT_INSTALLED=TRUE/);
  assert.match(script, /NO_LIVE_ADS=TRUE/);
});


test('Local API37 compile uses only disposable Android library and no APK/install', () => {
  const s=read('scripts/LevelPlay-Android-API37-CompileOnly.ps1');
  assert.match(s, /DateLotto-LevelPlay-API37-CompileOnly-/);
  assert.match(s, /PILOT_BRANCH=PASS; WORKTREE_CLEAN=PASS/);
  assert.doesNotMatch(s, /^\s*\$host\s*=/gmi, 'Reserved PowerShell $Host variable must not be assigned');
  assert.match(s, /\$bannerHostFile = Join-Path \$repo/);
  assert.match(s, /Copy-Item -LiteralPath \$bannerHostFile/);
  assert.match(s, /DOUBLE_SAFETY_GATES=PASS/);
  assert.match(s, /platforms\\android-37\.0\\android\.jar/);
  assert.match(s, /WriteAllText\(\$copiedGradle/);
  assert.match(s, /\.Replace\('compileSdk = 36', 'compileSdk = 37'\)/);
  assert.match(s, /& \$wrapper -p \$tempRoot --no-daemon --console=plain compileDebugKotlin/);
  assert.doesNotMatch(s, /(?:\bassembleDebug\b|\binstallDebug\b|\badb\s+install\b|\btauri\s+android\s+build\b)/i);
  assert.match(s, /ORIGINAL_REPO_UNMODIFIED/);
  assert.match(s, /NO_AD_REQUESTS=TRUE; PRODUCTION_NO_GO=TRUE/);
});
