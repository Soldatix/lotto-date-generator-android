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
