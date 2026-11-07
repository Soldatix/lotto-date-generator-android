import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const base='src-tauri/gen/android/app/';
const g=read(base+'build.gradle.kts');
const m=read(base+'src/main/AndroidManifest.xml');
const a=read(base+'src/n7ConsentPilot/java/org/appsandgames/datelottogenerator/N7UmpPreviewActivity.kt');
const dm=read(base+'src/n7ConsentPilot/AndroidManifest.xml');
const main=read(base+'src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt');
const workflow=read('.github/workflows/levelplay-android-kotlin-compile.yml');

test('N7 UMP-only debug opt-in does not enable Unity LevelPlay or normal/release SDKs',()=>{
 assert.match(g,/appsGamesN7UmpPreview/);
 assert.match(g,/if \(n7UmpPreview && levelPlaySdkPilot\)/);
 assert.match(g,/N7_UMP_ONLY/);
 assert.match(g,/N7_PRODUCTION_NO_GO/);
 assert.match(g,/APPSGAMES_N7_ADMOB_APP_ID/);
 assert.match(g,/Regex\("""ca-app-pub-/);
 assert.match(g,/getByName\("debug"\)\.manifest\.srcFile\("src\/n7ConsentPilot\/AndroidManifest\.xml"\)/);
 assert.match(g,/getByName\("main"\)\.java\.srcDir\("src\/n7ConsentPilot\/java"\)/);
 assert.match(g,/if \(n7UmpPreview\) \{\s*\/\/ Consent-only debug activity; deliberately no LevelPlay dependency.\s*implementation\("com\.google\.android\.ump:user-messaging-platform:4\.0\.0"\)/);
 assert.doesNotMatch(m,/APPLICATION_ID|N7UmpPreviewActivity/);
 assert.doesNotMatch(main,/N7UmpPreviewActivity|UserMessagingPlatform|LevelPlay\.init/);
});

test('N7 preview demands exact debug package and explicit ADB Intent extra',()=>{
 assert.match(a,/PILOT_PACKAGE/);
 assert.match(a,/ApplicationInfo\.FLAG_DEBUGGABLE/);
 assert.match(a,/DEBUG_N7_UMP_PREVIEW/);
 assert.match(a,/getBooleanExtra\(EXTRA_PREVIEW, false\)/);
 assert.match(a,/requestConsentInfoUpdate\(/);
 assert.match(a,/loadAndShowConsentFormIfRequired\(/);
 assert.match(a,/N7_UMP=REFRESH_STARTED_NO_ADS/);
 assert.match(a,/N7_UMP=FORM_COMPLETED_OR_NOT_REQUIRED_NO_ADS/);
 assert.doesNotMatch(a,/canRequestAds\(|LevelPlay\s*\.\s*init\s*\(|loadAd\(|MobileAds\s*\.|advertisingId|setGDPRConsent\(/);
 assert.match(dm,/android:value="\$\{appsGamesN7AdMobAppId\}"/);
 assert.match(dm,/android:name="\.N7UmpPreviewActivity"/);
 assert.match(workflow,/N7UmpPreviewActivity\.kt/);
 assert.match(workflow,/-eq 11/);
 for(const s of [g,a,dm]){
   assert.doesNotMatch(s,/294760d25|vu3eqmvs1u5vo6wi|3903782993/);
 }
});
