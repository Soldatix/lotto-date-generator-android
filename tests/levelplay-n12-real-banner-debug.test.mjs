import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const src = 'src-tauri/gen/android/app/src/';
const activity = load(src + 'n12BannerPilot/java/org/appsandgames/datelottogenerator/N12LottoBannerActivity.kt');
const manifest = load(src + 'n12BannerPilot/AndroidManifest.xml');
const host = load(src + 'main/java/org/appsandgames/datelottogenerator/NativeBannerHostProbe.kt');
const anchor = load(src + 'main/java/org/appsandgames/datelottogenerator/NativeAnchoredBannerProbe.kt');
const main = load(src + 'main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const gradle = load('src-tauri/gen/android/app/build.gradle.kts');
const ci = load('.github/workflows/levelplay-android-kotlin-compile.yml');
const harness = load('ci/android-levelplay-compile/build.gradle.kts');
const runner = load('scripts/LevelPlay-N12-BannerBuildOnly-NoPrompt.ps1');
const webCi = load('.github/workflows/web-pwa-settings-check.yml');
const oneApproved = load('scripts/LevelPlay-N12-OneApprovedHuaweiBanner-NoPrompt.ps1');
const secondApproved = load('scripts/LevelPlay-N12-SecondApprovedHuaweiErrorCode-NoPrompt.ps1');

test('N12 is an isolated debug-only Tauri Activity and never the production MainActivity', () => {
  assert.match(activity, /class N12LottoBannerActivity : TauriActivity\(\)/);
  assert.match(activity, /NativeBannerHostProbe\(this, this\)/);
  assert.match(gradle, /appsGamesN12LottoBannerPilot/);
  assert.match(gradle, /N12_PRODUCTION_NO_GO/);
  assert.match(gradle, /N12_SEPARATE_ISOLATED_DEBUG_ONLY/);
  assert.match(gradle, /sourceSets\.getByName\("debug"\)\.java\.srcDir\("src\/n12BannerPilot\/java"\)/);
  assert.match(gradle, /sourceSets\.getByName\("debug"\)\.manifest\.srcFile\("src\/n12BannerPilot\/AndroidManifest.xml"\)/);
  assert.doesNotMatch(main, /N12LottoBannerActivity|LevelPlay\.|UserMessagingPlatform|N12_OWNER_TEST/);
  assert.match(manifest, /<activity android:name="\.N12LottoBannerActivity"/);
  assert.match(manifest, /com\.ironsource\.lifecycle\.IronsourceLifecycleProvider/);
  assert.match(manifest, /com\.ironsource\.lifecycle\.LevelPlayActivityLifecycleProvider/);
  assert.match(manifest, /tools:node="remove"/);
});

test('N12 isolates actual SDK start and load to explicit full-consent owner test action', () => {
  for (const marker of [
    'DEBUG_N12_TEST_BANNER',
    'BuildConfig.DEBUG',
    'N12_OWNER_TEST_AD_REQUESTS_APPROVED',
    'APPSGAMES_N12_OWNER_TEST_APPROVAL',
    'ENABLE_N12_HUAWEI_ONE_TEST_BANNER',
    'requestConsentInfoUpdate(',
    'loadAndShowConsentFormIfRequired(this)',
    'showPrivacyOptionsForm(this)',
    'IABTCF_PurposeConsents',
    "purpose.take(10).all { it == '1' }",
    'private fun startSdkFromExplicitUserTap()',
    'private fun mountBannerOnlyInValidatedN5Slot()',
    'LevelPlay.init(',
    'ad.loadAd()',
    'LevelPlayBannerAdView',
    'N4BannerSizeFitPolicy.fit(',
    'disableAndDestroyBanner()',
    'override fun onAnchorHidden()'
  ]) assert.ok((activity + gradle).includes(marker), marker);
  assert.match(activity, /if \(!ownerDebugOnly\(\) \|\|[\s\S]*?!BuildConfig\.N12_OWNER_TEST_AD_REQUESTS_APPROVED/);
  assert.match(activity, /if \(ownerDebugOnly\(\) && hasExplicitFullTcfOptIn\(\) &&[\s\S]*?ad\.loadAd\(\)/);
  assert.doesNotMatch(activity, /AdvertisingIdClient|IABTCF_TCString|setGDPRConsent\(|Log\.[idw]\([^\n]*(purpose|AppKey|AD_ID)/);
});

test('N12 uses verified N5 placement and never changes default N3/normal pipeline', () => {
  assert.match(host, /n12OnlyListener: NativeBannerAnchorListener\? = null/);
  assert.match(host, /it\.registerN12IsolatedBannerListener\(listener\)/);
  assert.match(anchor, /fun registerN12IsolatedBannerListener\(listener: NativeBannerAnchorListener\)/);
  assert.match(anchor, /N3_SDK_PLACEMENT_HANDOFF_APPROVED = false/);
  assert.match(ci, /N12LottoBannerActivity\.kt/);
  assert.match(ci, /N12CiTauriStub\.kt/);
  assert.match(ci, /-eq 17/);
  assert.match(harness, /N12_OWNER_TEST_AD_REQUESTS_APPROVED", "false"/);
  assert.match(gradle, /APPSGAMES_N7_ADMOB_APP_ID/);
});

test('N12 single-use Windows banner APK script never installs/starts SDK or enables test requests',()=>{
  for(const marker of [
    'NO_PROMPTS=TRUE; NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE',
    'N12_DISPOSABLE_CLONE_REQUIRED',
    'N12_SOURCE_GUARD_',
    'N12_BUILD_ONLY_AD_REQUEST_APPROVAL_MUST_BE_UNSET',
    'N12_PRECONSENT_SDK_PROVIDER_PRESENT',
    'N12_N8_UMP_SOURCE_APK_HASH_MISMATCH',
    'APPSGAMES_N12_LEVELPLAY_APP_KEY',
    'APPSGAMES_N12_LEVELPLAY_BANNER_UNIT_ID',
    'ORG_GRADLE_PROJECT_appsGamesN12LottoBannerPilot',
    'N12_BUILD=PASS; N12_MANIFEST=PASS; DEBUG_PACKAGE_ISOLATION=PASS',
    'TEST_AD_REQUESTS=OFF; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE'
  ])assert.ok(runner.includes(marker),marker);
  assert.doesNotMatch(runner,/Read-Host|adb\.exe|Invoke-WebRequest|Invoke-RestMethod|Start-Process/);
  assert.doesNotMatch(runner,/\binstall\s+-r\b|\badb\s+shell\b/);
  assert.match(webCi,/N12_POWERSHELL_SYNTAX=PASS/);
});

test('N12 owner-approved test is exactly one SDK load across process restarts',()=>{
  for(const marker of [
    'one_request_used','consumeOneApprovedTest()',
    'alreadyUsedOneApprovedTest()','banner?.pauseAutoRefresh()',
    'oneTestAttempted = true'
  ])assert.ok(activity.includes(marker),marker);
  assert.match(activity,/BuildConfig\.N12_OWNER_TEST_AD_REQUESTS_APPROVED\s*&&\s*consumeOneApprovedTest\(\)/);
});

test('N12 authorized runner cannot install on OPPO or touch production app',()=>{
  for(const marker of [
    'N12_EXPLICIT_APPROVAL_REQUIRED','ENABLE_N12_HUAWEI_ONE_TEST_BANNER',
    'N12_EXACTLY_ONE_HUAWEI_CMR_W09_ANDROID9_REQUIRED',
    'N12_DEVICE_HUAWEI_CMR_W09_API28_ARM64=PASS',
    'org.appsandgames.datelottogenerator.levelplaypilot',
    'N12_PRODUCTION_PACKAGE_STATE_CHANGED',
    'N12_HUAWEI_ISOLATED_INSTALL=PASS',
    'DEBUG_N12_TEST_BANNER',
    'N12_TAURI_AND_UMP_LAUNCH=REQUESTED; LEVELPLAY_LOAD=NOT_TRIGGERED',
    'NEXT=ACTIVATE_UNITY_TEST_ADS_ON_REGISTERED_HUAWEI_THEN_USER_TAPS_TEST'
  ])assert.ok(oneApproved.includes(marker),marker);
  assert.doesNotMatch(oneApproved,/\b(?:uninstall|am force-stop|install -r)\s+org\.appsandgames\.datelottogenerator\b/);
  assert.doesNotMatch(oneApproved,/Read-Host|Invoke-WebRequest|Invoke-RestMethod/);
  assert.match(webCi,/N12_HUAWEI_ONE_TEST_POWERSHELL_SYNTAX=PASS/);
});

test('N12 consent/test controls stay in front of late-creating Tauri WebView',()=>{
  for (const marker of [
    'private var testControls: LinearLayout? = null',
    'private var testControlsRoot: FrameLayout? = null',
    'val root = window.decorView as? FrameLayout',
    'N12_TEST_CONTROLS_ADDED_TO_DECOR',
    'private fun keepDebugControlsVisible()',
    'panel.bringToFront()',
    'root.postDelayed({ keepDebugControlsVisible() }, 1000L)',
    'root.postDelayed({ keepDebugControlsVisible() }, 3000L)',
    'keepDebugControlsVisible()',
    'topMargin = dp(120)'
  ]) assert.ok(activity.includes(marker), marker);
  assert.match(activity, /override fun onAnchorVisible\(bounds: NativeBannerAnchorBounds\)[\s\S]*?keepDebugControlsVisible\(\)/);
  assert.match(activity, /override fun onResume\(\)[\s\S]*?nativeRoot\?\.post \{ keepDebugControlsVisible\(\) \}/);
  // The temporary WebView-root can be replaced: requiring a decor-root sibling
  // prevents invisible panels even if bringToFront() is called repeatedly.
  assert.match(activity, /if \(panel\.parent !== root\) \{[\s\S]*?root\.addView\(/);
  assert.match(activity, /\(testControls\?\.parent as\? android\.view\.ViewGroup\)\?\.removeView\(testControls\)/);
});

test('N12 banner failure reports only numeric SDK code and never triggers another request',()=>{
  assert.match(activity, /override fun onAdLoadFailed\(error: LevelPlayAdError\)[\s\S]*?val code = error\.errorCode/);
  assert.match(activity, /N12_BANNER_LOAD_FAILED_CODE=\$code/);
  assert.match(activity, /TEST banner nije učitan · kod \$code · nema ponavljanja/);
  assert.match(activity, /N12_BANNER_DISPLAY_FAILED_CODE=\$code/);
  assert.doesNotMatch(activity, /error\.errorMessage|Log\.[a-z]+\([^\n]*error\.toString/);
  assert.match(activity, /consumeOneApprovedTest\(\)/);
  assert.match(activity, /one_request_used/);
});

test('Second owner-approved diagnostic load requires first attempt evidence, distinct build approval and is single-use',()=>{
  for(const marker of [
    'N12_SECOND_TEST_ERROR_CODE_APPROVED',
    'second_error_code_request_used',
    'one_request_used',
    'return !firstUsed || prefs.getBoolean("second_error_code_request_used", false)',
    'val saved = oneTestPrefs().edit().putBoolean(name, true).commit()',
    'N12_BANNER_LOAD_FAILED_CODE=',
    'ad.pauseAutoRefresh()'
  ])assert.ok(activity.includes(marker),marker);
  assert.match(gradle,/APPSGAMES_N12_SECOND_ERROR_CODE_APPROVAL/);
  assert.match(gradle,/ENABLE_N12_HUAWEI_SECOND_TEST_ERROR_CODE/);
  assert.match(gradle,/n12SecondTestApproved = n12ApprovedTest &&/);
  assert.match(harness,/N12_SECOND_TEST_ERROR_CODE_APPROVED", "false"/);
  assert.doesNotMatch(activity,/\bad\.resumeAutoRefresh\(\)/);
});

test('Second-approved Huawei-only runner preserves first request and never silently starts SDK',()=>{
  for(const marker of [
    'N12_SECOND_EXPLICIT_APPROVAL_REQUIRED',
    'ENABLE_N12_HUAWEI_SECOND_TEST_ERROR_CODE',
    'APPSGAMES_N12_SECOND_ERROR_CODE_APPROVAL',
    'N12_EXISTING_TEST_APP_DATA=RETAINED_BY_ADB_INSTALL_R',
    'N12_EXACTLY_ONE_HUAWEI_CMR_W09_ANDROID9_REQUIRED',
    'N12_HUAWEI_ISOLATED_INSTALL=PASS',
    'N12_TAURI_AND_UMP_LAUNCH=REQUESTED; LEVELPLAY_LOAD=NOT_TRIGGERED',
    'N12_SECOND_REQUEST_SINGLE_USE_GUARD',
    'N12_PRODUCTION_PACKAGE_STATE_CHANGED',
    'N12_BANNER_LOAD_FAILED_CODE='
  ])assert.ok(secondApproved.includes(marker),marker);
  assert.doesNotMatch(secondApproved,/Read-Host|adb\s+shell\s+pm\s+clear|\buninstall\b|Invoke-RestMethod|Invoke-WebRequest/);
  assert.match(webCi,/N12_SECOND_APPROVED_POWERSHELL_SYNTAX=PASS/);
});
