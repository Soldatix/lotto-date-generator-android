import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const src = 'src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/';
const app = read('src-tauri/gen/android/app/build.gradle.kts');
const main = read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const manifest = read('src-tauri/gen/android/app/src/main/AndroidManifest.xml');
const sdk = read(src+'LevelPlaySdkBannerDraft.kt');
const readiness = read(src+'N6AdMobReadinessGate.kt');
const ump = read(src+'N6UmpConsentApiDraft.kt');
const workflow = read('.github/workflows/levelplay-android-kotlin-compile.yml');
const ciGradle=read('ci/android-levelplay-compile/build.gradle.kts');

test('N6 UMP 4.0.0 strictly in SDK opt-in source and disposable compile-only CI',()=>{
  assert.match(app,/if \(levelPlaySdkPilot\) \{\s*implementation\("com\.unity3d\.ads-mediation:mediation-sdk:9\.5\.0"\)/);
  assert.match(app,/if \(levelPlaySdkPilot\) \{[\s\S]*?implementation\("com\.google\.android\.ump:user-messaging-platform:4\.0\.0"\)/);
  assert.match(ciGradle,/com\.google\.android\.ump:user-messaging-platform:4\.0\.0/);
  assert.match(workflow,/N6UmpConsentApiDraft\.kt/);
  assert.match(workflow,/N6AdMobReadinessGate\.kt/);
  assert.match(workflow,/-eq 13/);
  assert.doesNotMatch(main,/N6UmpConsentApiDraft|UserMessagingPlatform|N6AdMobReadinessGate/);
  assert.doesNotMatch(manifest,/com\.google\.android\.gms\.ads\.APPLICATION_ID/);
});

test('N6 UMP API draft cannot run or imply readiness for any network',()=>{
  assert.match(ump,/N6_UMP_RUNTIME_APPROVED = false/);
  assert.match(ump,/N6_ADMOB_CONFIGURATION_APPROVED = false/);
  assert.match(ump,/if \(!N6_UMP_RUNTIME_APPROVED \|\| !N6_ADMOB_CONFIGURATION_APPROVED\) return false/);
  assert.match(ump,/getConsentInformation\(activity\)/);
  assert.match(ump,/requestConsentInfoUpdate\(/);
  assert.match(ump,/loadAndShowConsentFormIfRequired\(/);
  assert.match(ump,/privacyOptionsRequirementStatus/);
  assert.match(ump,/showPrivacyOptionsForm\(/);
  assert.match(ump,/canRequestAds\(/);
  assert.doesNotMatch(ump,/LevelPlay\.init\(|\.loadAd\(|advertisingId|sharedPreferences|ca-app-pub-/i);
});

test('N6 unknown account and OPPO approval remain NO_GO independent of CMP mock',()=>{
  assert.match(readiness,/N6_RELEASE_AND_AD_REQUESTS_APPROVED = false/);
  assert.match(readiness,/val adMobAccountConfirmed: Boolean = false/);
  assert.match(readiness,/val developerAccountVerified: Boolean = false/);
  assert.match(readiness,/val publicStoreLinkedAndAppReviewed: Boolean = false/);
  assert.match(readiness,/fun missingForCmpPilot/);
  assert.match(readiness,/fun missingForRelease/);
  assert.match(readiness,/fun canInitializeSdkOrRequestAds/);
  assert.match(sdk,/N6AdMobReadinessGate\.canInitializeSdkOrRequestAds\(N6AdMobReadiness\(\)\)/);
  assert.match(sdk,/APPROVED_AD_REQUESTS = false/);
  assert.match(sdk,/N4ConsentGateDraft\.sdkInitializationPermitted\(N4CmpEvidence\(\)\)/);
  assert.doesNotMatch(readiness,/LevelPlay\.init\(|\.loadAd\(|UserMessagingPlatform|http/);
});
