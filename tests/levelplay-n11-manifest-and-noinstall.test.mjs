import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

const manifestWorkflow=read('.github/workflows/levelplay-n11-manifest-audit.yml');
const webWorkflow=read('.github/workflows/web-pwa-settings-check.yml');
const auditGradle=read('ci/android-levelplay-manifest-audit/build.gradle.kts');
const manifestReview=read('ci/android-levelplay-manifest-audit/review_merged_manifests.py');
const providerAudit=read('ci/android-levelplay-manifest-audit/inspect_lifecycle_providers.py');
const delegateAudit=read('ci/android-levelplay-manifest-audit/inspect_delegated_provider_calls.py');
const n11=read('scripts/LevelPlay-N11-CombinedSDK-DebugBuild-NoInstall.ps1');
const appGradle=read('src-tauri/gen/android/app/build.gradle.kts');

test('N11 audit does only Gradle manifest merges, no APK, and reports privacy delta',()=>{
  for(const val of [
    'processDebugMainManifest','n11WithLevelPlay=false','n11WithLevelPlay=true',
    '/tmp/n11-ump-only-merged.xml','/tmp/n11-sdk-merged.xml',
    'review_merged_manifests.py','N11_APK_AAB=NONE','N11_REAL_TAURI_SOURCE_MANIFESTS_COPIED=PASS'
  ])assert.ok(manifestWorkflow.includes(val),val);
  for(const val of [
    'OBSERVED_SDK95_COMPONENT_ADDITIONS','OBSERVED_SDK95_PERMISSION_ADDITIONS',
    'N11_UNEXPECTED_SDK95_COMPONENT_SURFACE_DRIFT',
    'N11_UNEXPECTED_SDK95_PERMISSION_SURFACE_DRIFT',
    'IronsourceLifecycleProvider','LevelPlayActivityLifecycleProvider',
    'ACCESS_ADSERVICES_ATTRIBUTION','ACCESS_NETWORK_STATE',
    'N11_REAL_TAURI_TARGET37_FINAL_MERGE=NOT_YET_VERIFIED'
  ])assert.ok(manifestReview.includes(val),val);
  assert.doesNotMatch(manifestWorkflow, /\b(?:assembleDebug|assembleRelease|installDebug|installRelease|bundleRelease)\b/);
  assert.match(auditGradle,/com\.unity3d\.ads-mediation:mediation-sdk:9\.5\.0/);
  assert.match(auditGradle,/com\.google\.android\.ump:user-messaging-platform:4\.0\.0/);
  assert.match(auditGradle,/N11_AUDIT_NO_REAL_ADMOB_ID/);
});

test('N11 no-prompt physical API37 APK construction never installs or starts SDK',()=>{
  for(const val of [
    'NO_PROMPTS=TRUE; NO_ADB=TRUE; NO_INSTALL=TRUE; NO_LAUNCH=TRUE',
    'N11_DISPOSABLE_TEMP_CLONE_REQUIRED',
    '40CE83AC44EF7C1398C0A74558F6BE7299BCF1F340C9FE12C828D7418C639798',
    'N11_PRIOR_N8_APK_SHA256_MISSING_OR_MISMATCH',
    'N11_NO_AD_REQUEST_GATES=PASS',
    'APPROVED_AD_REQUESTS = false',
    'N10_SDK_INIT_APPROVED = false',
    'N10_TEST_AD_REQUESTS_APPROVED = false',
    'N10_UMP_RUNTIME_APPROVED = false',
    'N10_N5_SDK_HANDOFF_APPROVED = false',
    'N3_SDK_PLACEMENT_HANDOFF_APPROVED = false',
    'ORG_GRADLE_PROJECT_appsGamesN9ConsentBannerReview',
    'N11_FRESH_COMBINED_APK_MISSING',
    'N11_COMBINED_APK_SHA256=',
    'SDK_STARTUP_PRIVACY_REVIEW=PENDING'
  ])assert.ok(n11.includes(val),val);
  assert.doesNotMatch(n11,/Read-Host|Start-Process|Invoke-RestMethod|Invoke-WebRequest|adb\.exe|adb\s+(?:install|shell)|Test-Ad-Load/);
  assert.doesNotMatch(n11,/\b(?:loadAd|LevelPlay\.init|uninstall|bundleRelease|--release)\s*\(/);
  assert.match(webWorkflow,/N11_POWERSHELL_SYNTAX=PASS/);
  assert.match(appGradle,/N9_PRODUCTION_NO_GO/);
});

test('N11-B statically inventories SDK 9.5 lifecycle provider onCreate without runtime',()=>{
  for(const value of [
    'IronsourceLifecycleProvider','LevelPlayActivityLifecycleProvider',
    'onCreate();', 'javap', 'subprocess.run',
    'N11_B_STATIC_PROVIDER_BYTECODE_INVENTORY=PASS',
    'N11_B_PRECONSENT_PROVIDER_SAFETY=REQUIRES_REVIEW',
    'N11_B_NO_APK_NO_INSTALL_NO_SDK_EXECUTION_NO_AD_REQUESTS=TRUE'
  ])assert.ok(providerAudit.includes(value),value);
  assert.match(manifestWorkflow,/inspect_lifecycle_providers\.py/);
  assert.doesNotMatch(providerAudit,/adb|loadAd\(|LevelPlay\.init\(|Read-Host|http\.client|requests\.get/);
});

test('N11-C audits obfuscated provider delegates with pinned AAR and never executes SDK',()=>{
  for(const marker of [
    'N11_C_PINNED_AAR=mediation-sdk-9.5.0.aar',
    'com.ironsource.lifecycle.b',
    'com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider',
    'javap', 'METHOD_DECL', 'CALL.search',
    'N11_C_HELPER_TARGET_SIGNATURE_CHANGED',
    'N11_C_ACTIVITY_DELEGATE_SIGNATURE_CHANGED',
    'N11_C_DELEGATED_BYTECODE_REVIEW=PASS',
    'N11_C_PRIVACY_SAFETY=STILL_NOT_PROVEN',
    'N11_C_SDK_INSTALL=HOLD',
    'N11_C_NO_APK_NO_INSTALL_NO_SDK_EXECUTION_NO_AD_REQUESTS=TRUE'
  ])assert.ok(delegateAudit.includes(marker), marker);
  assert.match(manifestWorkflow,/inspect_delegated_provider_calls\.py/);
  assert.doesNotMatch(delegateAudit,/adb\s|LevelPlay\.init\(|loadAd\(|requests\.get|urllib\.request|Read-Host/);
});

test('N11-D only removes pre-consent providers in disposable CI manifest, never production',()=>{
  for(const marker of [
    'N11-D simulate debug-only provider suppression in CI sandbox',
    "ci/android-levelplay-manifest-audit/src/debug/AndroidManifest.xml",
    'com.ironsource.lifecycle.IronsourceLifecycleProvider',
    'com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider',
    "'remove'",
    'N11_D_PROVIDER_SUPPRESSION_PROXY=PASS',
    'N11_D_SDK_RUNTIME_COMPATIBILITY=UNVERIFIED',
    'N11_D_PRODUCTION_MANIFEST=UNCHANGED; SDK_INSTALL=HOLD'
  ])assert.ok(manifestWorkflow.includes(marker),marker);
  assert.doesNotMatch(appGradle,/tools:node="remove"|N11_D_PROVIDER_SUPPRESSION/);
});
