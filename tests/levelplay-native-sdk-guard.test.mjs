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
