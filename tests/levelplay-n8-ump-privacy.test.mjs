import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const activity=readFileSync(new URL("../src-tauri/gen/android/app/src/n7ConsentPilot/java/org/appsandgames/datelottogenerator/N8UmpPrivacyOptionsActivity.kt",import.meta.url),"utf8");
const manifest=readFileSync(new URL("../src-tauri/gen/android/app/src/n7ConsentPilot/AndroidManifest.xml",import.meta.url),"utf8");
const gradle=readFileSync(new URL("../src-tauri/gen/android/app/build.gradle.kts",import.meta.url),"utf8");
const ci=readFileSync(new URL("../.github/workflows/levelplay-android-kotlin-compile.yml",import.meta.url),"utf8");

test("N8 privacy UI is debug-only, explicitly guarded, and UMP-only",()=>{
  for (const value of [
    "N8UmpPrivacyOptionsActivity", "DEBUG_N8_UMP_PRIVACY",
    "org.appsandgames.datelottogenerator.levelplaypilot", "FLAG_DEBUGGABLE",
    "requestConsentInfoUpdate", "loadAndShowConsentFormIfRequired",
    "privacyOptionsRequirementStatus", "showPrivacyOptionsForm",
    "ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED",
    "DEBUG_RESET_FOR_TEST_ONLY", "info.reset()",
    "DateLottoN8UMP", "canRequestAds()", "Oglasi: ISKLJUČENI"
  ])assert.ok(activity.includes(value), value);
  assert.match(manifest,/<activity android:name="\.N8UmpPrivacyOptionsActivity"/);
  assert.match(gradle,/if \(n7UmpPreview\) \{/);
  assert.match(gradle,/N7_UMP_ONLY: LevelPlay cannot run before consent/);
  assert.match(gradle,/N7_PRODUCTION_NO_GO/);
  assert.match(ci,/cp .*N8UmpPrivacyOptionsActivity\.kt/);
  assert.doesNotMatch(activity,/LevelPlay\.init|loadAd\(|LevelPlayBannerAdView|advertisingId|AdvertisingIdClient/);
});

test("N8 reset is only a direct user action in isolated test Activity",()=>{
  const resetCall=activity.indexOf("info.reset()");
  const button=activity.lastIndexOf("setOnClickListener",resetCall);
  assert.ok(button>=0 && resetCall>button);
  assert.match(activity,/if \(!allowed\) \{/);
  assert.doesNotMatch(activity,/MainActivity\(/);
  assert.doesNotMatch(activity,/SharedPreferences|TCString|IABTCF/);
});
