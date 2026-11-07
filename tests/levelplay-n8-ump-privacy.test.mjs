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

const runner=readFileSync(new URL("../scripts/LevelPlay-Huawei-N8-PrivacyOptions-NoPrompt.ps1",import.meta.url),"utf8");
test("N8 no-prompt Huawei runner reuses verified local N7 ID and never activates ads",()=>{
 for(const value of [
   "NO_PROMPTS=TRUE", "REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE",
   "65ABEF8ED904BB808A10C5012175E69AA2D06645AED395E89F8A908CBE4EB6A1",
   "GITHUB_SOURCE", "N8UmpPrivacyOptionsActivity", "DEBUG_N8_UMP_PRIVACY",
   "LEVELPLAY_SDK=ABSENT", "APPROVED_AD_REQUESTS = false",
   "APPSGAMES_N7_ADMOB_APP_ID", "& $npm @CommandArgs",
   "$nativeExit=$LASTEXITCODE", "N8_NPM_CI=REUSE_COMPLETED_INSTALL",
   "EXACTLY_ONE_HUAWEI"
 ].filter(Boolean)) {
   if(value==="GITHUB_SOURCE" || value==="EXACTLY_ONE_HUAWEI")continue;
   assert.ok(runner.includes(value),value);
 }
 assert.doesNotMatch(runner,/Read-Host|Pause|InputBox|adb\s+uninstall|--release|bundleRelease|LevelPlay\.init/);
 assert.doesNotMatch(runner,/function RunBuild\(\[string\[\]\]\$Args\b/);
 assert.doesNotMatch(runner,/Start-Process\s+-FilePath\s+\$npm|\.WaitForExit\(/);
 assert.match(runner,/\$null -eq \$nativeExit -or \$nativeExit -ne 0/);
 assert.match(runner,/node_modules\\\\\.package-lock\.json/);

 assert.match(runner,/\$sourceSha='65ABEF8ED904BB808A10C5012175E69AA2D06645AED395E89F8A908CBE4EB6A1'/);
});
