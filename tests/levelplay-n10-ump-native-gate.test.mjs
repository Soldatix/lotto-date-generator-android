import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const prefix = 'src-tauri/gen/android/app/src/';
const gradle = read('src-tauri/gen/android/app/build.gradle.kts');
const main = read(prefix + 'main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const bridge = read(prefix + 'levelplayPilot/java/org/appsandgames/datelottogenerator/N10UmpNativeCoordinator.kt');
const state = read(prefix + 'levelplayPilot/java/org/appsandgames/datelottogenerator/N10FailClosedSession.kt');
const sdk = read(prefix + 'levelplayPilot/java/org/appsandgames/datelottogenerator/LevelPlaySdkBannerDraft.kt');
const native = read(prefix + 'main/java/org/appsandgames/datelottogenerator/NativeAnchoredBannerProbe.kt');
const wf = read('.github/workflows/levelplay-android-kotlin-compile.yml');
const unit = read('ci/android-levelplay-compile/src/test/java/org/appsandgames/datelottogenerator/N10FailClosedSessionTest.kt');

test('N10 real UMP calls are unreachable in the review-only combined source set', () => {
  for (const marker of [
    'requestConsentInfoUpdate(',
    'loadAndShowConsentFormIfRequired(activity)',
    'showPrivacyOptionsForm(activity)',
    'getConsentInformation(activity)',
    'N10_UMP_RUNTIME_APPROVED = false',
    'N10_N5_SDK_HANDOFF_APPROVED = false',
    'PILOT_PACKAGE',
    'ApplicationInfo.FLAG_DEBUGGABLE',
    'startConsentCheckAfterSeparateReview',
    'showPrivacyOptionsFromUserTap',
    'listenerForFutureN5Handoff'
  ]) assert.ok(bridge.includes(marker), marker);
  assert.doesNotMatch(bridge, /LevelPlay\.init|loadAd\(|LevelPlayBannerAdView\(|AdvertisingIdClient|SharedPreferences|setGDPRConsent/);
  assert.doesNotMatch(main, /N10UmpNativeCoordinator|N10FailClosedSession|UserMessagingPlatform|LevelPlay\.init/);
  assert.match(gradle, /appsGamesN9ConsentBannerReview/);
  assert.match(gradle, /N9_SEPARATE_DEBUG_REVIEW_REQUIRED/);
  assert.match(gradle, /N9_PRODUCTION_NO_GO/);
});

test('N10 refusal, withdrawal, race, pause and native placement cannot start ads', () => {
  for (const marker of [
    'N10_SDK_INIT_APPROVED = false',
    'N10_TEST_AD_REQUESTS_APPROVED = false',
    'sdkInitializationAllowed = N10_SDK_INIT_APPROVED && false',
    'testAdRequestAllowed = N10_TEST_AD_REQUESTS_APPROVED && false',
    'fun withdrawn()',
    'fun failClosed()',
    'fun beginPrivacyOptionsFromUserAction()',
    'fun privacyOptionsClosed(',
    'generation++',
    'fun pause()',
    'fun close()',
    'N4BannerSizeFitPolicy.fit('
  ]) assert.ok(state.includes(marker), marker);
  assert.match(state, /privacyOptionsClosed[\s\S]*?withdrawn\(\)/);
  assert.match(bridge, /fun onConsentRevoked\(\)/);
  assert.match(bridge, /override fun onAnchorHidden\(\)/);
  assert.match(bridge, /override fun onAnchorReleased\(\)/);
  assert.doesNotMatch(bridge, /N10_TEST_AD_REQUESTS_APPROVED\s*=\s*true/);
  assert.match(sdk, /APPROVED_AD_REQUESTS = false/);
  assert.match(native, /N3_SDK_PLACEMENT_HANDOFF_APPROVED = false/);
  assert.match(wf, /N10FailClosedSession\.kt/);
  assert.match(wf, /N10UmpNativeCoordinator\.kt/);
  assert.match(wf, /-eq 15/);
  assert.match(unit, /delayedCallbacksCannotResurrectConsentAfterWithdrawal/);
  assert.match(unit, /rejectionAfterPrivacyFormAlwaysRevokesN5Candidate/);
});

test('N10 contains no publisher keys, identifiers or direct advertising endpoints', () => {
  for (const s of [state, bridge]) {
    assert.doesNotMatch(s, /ca-app-pub-\d{16}~\d{10}|294760d25|vu3eqmvs1u5vo6wi|3903782993/);
    assert.doesNotMatch(s, /https?:\/\/|\.loadAd\(|LevelPlay\.init\(/);
  }
});
