import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const gradle = read('src-tauri/gen/android/app/build.gradle.kts');
const main = read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const n7 = read('src-tauri/gen/android/app/src/n7ConsentPilot/java/org/appsandgames/datelottogenerator/N7UmpPreviewActivity.kt');
const n8 = read('src-tauri/gen/android/app/src/n7ConsentPilot/java/org/appsandgames/datelottogenerator/N8UmpPrivacyOptionsActivity.kt');
const bridge = read('src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/N9ConsentBannerReview.kt');
const sdk = read('src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/LevelPlaySdkBannerDraft.kt');
const wf = read('.github/workflows/levelplay-android-kotlin-compile.yml');

test('N9 is a separately opted-in debug-only UMP+Unity SDK review classpath', () => {
  for (const marker of [
    'appsGamesN9ConsentBannerReview',
    'N9_SEPARATE_DEBUG_REVIEW_REQUIRED',
    'N9_PRODUCTION_NO_GO',
    'N9_PRIVATE_ADMOB_APP_ID_REQUIRED',
    'if (n9ReviewOnly)',
    'sourceSets.getByName("debug").java.srcDir("src/levelplayPilot/java")',
    'sourceSets.getByName("debug").java.srcDir("src/n7ConsentPilot/java")',
    'com.unity3d.ads-mediation:mediation-sdk:9.5.0',
    'com.google.android.ump:user-messaging-platform:4.0.0'
  ]) assert.ok(gradle.includes(marker), marker);
  assert.match(gradle, /n9ReviewOnly && \(n7UmpPreview \|\| levelPlaySdkPilot\)/);
  assert.match(gradle, /it\.contains\("release", ignoreCase = true\)/);
  assert.doesNotMatch(main, /N9ConsentBannerReview|UserMessagingPlatform|LevelPlay\.init/);
  assert.doesNotMatch(n7, /LevelPlay\.|N9ConsentBannerReview/);
  assert.doesNotMatch(n8, /LevelPlay\.|N9ConsentBannerReview/);
});

test('N9 never treats UMP canRequestAds as opt-in or unlocks an ad request', () => {
  for (const marker of [
    'N9_REAL_TEST_AD_REQUESTS_APPROVED = false',
    'requestTestAdAllowed = N9_REAL_TEST_AD_REQUESTS_APPROVED && false',
    'N9UserChoice.ACCEPTED_AFTER_REVIEW',
    'N9UserChoice.REJECTED',
    'N9UserChoice.WITHDRAWN',
    'refreshedThisLaunch',
    'approvedVendorAndPurposeEvidence',
    'huaweiRegisteredAsTestDevice',
    'privacyOptionsEntryPointVerified',
    'afterRefusalOrWithdrawal',
    'N4BannerSizeFitPolicy.fit',
    'LevelPlayAdSize.BANNER'
  ]) assert.ok(bridge.includes(marker), marker);
  assert.match(bridge, /canRequestAds\(\)/);
  assert.doesNotMatch(bridge, /LevelPlay\.init\(|\.loadAd\(|LevelPlayBannerAdView\(|setGDPRConsent\(|AdvertisingIdClient|Read-Host/);
  assert.match(sdk, /APPROVED_AD_REQUESTS = false/);
  assert.match(wf, /N9ConsentBannerReview\.kt/);
  assert.match(wf, /-eq 13/);
});

test('N9 contains no publisher identifiers, requests or ad network activation', () => {
  for (const s of [gradle,bridge,n7,n8]) {
    assert.doesNotMatch(s, /294760d25|vu3eqmvs1u5vo6wi|3903782993|ca-app-pub-\d{16}~\d{10}/);
  }
  assert.doesNotMatch(bridge, /https?:\/\/|loadAd\(|LevelPlay\.init\(/);
  assert.match(bridge, /return N9ConsentEvidence\(\)/);
});
