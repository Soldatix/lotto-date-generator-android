# Date Lotto Android — N11 LevelPlay SDK 9.5.0 / AdQuality manifest audit

**Date:** 2026-11-07
**Scope:** GitHub PR #2 Draft `pilot/levelplay-android-banner-2026-11-04`.
**Status:** **Manifest inventory reviewed in CI / SDK-enabled install NOT APPROVED**.
`REAL_ADS=OFF`, `PRODUCTION_NO_GO=TRUE`.

## Why this is necessary

According to Unity's official Android SDK integration and AdQuality documentation, LevelPlay since 8.9.0 bundles AdQuality; AdQuality is automatically initialized when LevelPlay is implemented. In Android, a manifest-declared ContentProvider may start code at process creation, independently from a future explicit `LevelPlay.init()` call. Therefore a simple application-side `APPROVED_AD_REQUESTS=false` flag is necessary but NOT sufficient proof that an SDK-enabled APK has no privacy-side effects.

References:
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/sdk-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/integrate-ad-quality
- https://developers.google.com/admob/android/privacy

## N11 CI technique and scope limits

- Disposable Gradle Android **manifest-only** project, AGP 9.3.1, Gradle wrapper from existing branch.
- Copies exactly the repo's actual `src-tauri/gen/android/app/src/main/AndroidManifest.xml` and `src/n7ConsentPilot/AndroidManifest.xml` (debug overlay) into the audit sandbox.
- Compares `processDebugMainManifest` output for Google **UMP 4.0.0 alone** versus **UMP 4.0.0 + Unity LevelPlay SDK 9.5.0**.
- Uses a **non-real sentinel** for AdMob App ID; does not run Kotlin, produce an APK/AAB, install to Huawei, initialize UMP/LevelPlay, fetch GAID, load an ad, or hit ad endpoints.
- Due to earlier GitHub SDK limitations, this is an **API 36 compile/target SDK proxy**, NOT the authoritative actual Tauri application's API 37 merged manifest. The full local API 37 merge must be audited separately before any physical SDK installation.
- Automated diff prints **component names, exported flags, permission names, metadata keys and counts only**. It never prints advertising IDs, developer keys, consent strings or metadata values.
- Automated hard stops for unexpected newly-exported SDK components, sensitive/new permissions, removal/export changes of existing components, and **any drift** from the observed pinned SDK 9.5.0 delta.
- Result: [GitHub Actions N11 manifest-only run](https://github.com/Soldatix/lotto-date-generator-android/actions/runs/42381494449) **PASS** with SDK privacy follow-up.

## Actual observed result (API 36 proxy)

| Field | UMP only | UMP + LevelPlay 9.5.0 | Delta |
|---|---:|---:|---:|
| Permissions | 1 | 3 | +2 |
| Android app components | 4 | 11 | +7 |
| Application metadata keys | 2 | 2 | 0 |

**Extra permissions:**
- `android.permission.ACCESS_NETWORK_STATE`
- `android.permission.ACCESS_ADSERVICES_ATTRIBUTION`

**Extra components (no expected package identifiers or test-device IDs leaked):**
- `com.ironsource.mediationsdk.testSuite.TestSuiteActivity` (exported=false)
- `com.ironsource.sdk.controller.ControllerActivity` (exported flag implicit)
- `com.ironsource.sdk.controller.InterstitialActivity` (exported flag implicit)
- `com.ironsource.sdk.controller.OpenUrlActivity` (exported flag implicit)
- `com.unity3d.ironsourceads.internal.services.InlineStoreActivity` (exported flag implicit)
- `com.ironsource.lifecycle.IronsourceLifecycleProvider` (exported=false)
- `com.ironsource.lifecycle.LevelPlayActivityLifecycleProvider` (exported=false)

New providers are **not exported**, but their names suggest possible process-start lifecycle hooks. The manifest by itself cannot prove whether either provider performs initialization, identifier access or network activity before the consent UI. This remains **HOLD / requires runtime and/or SDK review**. Do not mistake exported=false for no data collection.

**Advertising ID permission:** `com.google.android.gms.permission.AD_ID` is **absent** from this proxy. Unity's Android docs specify it for apps targeting API 33+ that use GAID; existing Gradle SDK-only classpath also does not add recommended Google Play Services App Set / Advertising ID integration automatically. Whether/when the app may request an advertising identifier must be reviewed explicitly with consent, Play Data Safety and user-audience classification before any real test-ad request. Do not add AD_ID implicitly to the existing production app.

**Cleartext:** debug variant reports `usesCleartextTraffic=true` because this Tauri debug configuration already uses that value. Real release uses its separate `usesCleartextTraffic=false` setting. No release manifest was changed by N11.

## Mandatory unresolved gates before an SDK-enabled Huawei APK

1. Review LevelPlay 9.5.0 + AdQuality auto-initialization timing and the lifecycle providers against the requirement to refresh UMP before advertising-related data processing. Consider privacy architecture alternatives; do not assume that only `LevelPlay.init()` starts SDK behavior.
2. Audit **actual Tauri Android API 37 merged debug manifest** from a separately authorized isolated build — activity/provider export values, permissions and generated/merged metadata — and compare with this proxy. Verify exact `.levelplaypilot` debug ID.
3. Verify user audience/content classification, AdMob published consent message and actual network partner/vendor purposes, Google Play Data Safety, GAID/AD_ID decisions, any adapter-specific consent requirements and AdQuality collection policy.
4. Implement safe, user-accessible UMP privacy options and an explicit withdrawal path that prevents new ad requests and destroys already mounted banners. The current N10 coordinator is only compile-only.
5. If cleared, seek **separate owner authorization** to build and physically install the isolated UMP + SDK test APK with no ad requests, inspect actual startup/logs; then request **another explicit authorization** before turning on time-limited Unity `Test ads` or a test-banner `loadAd()` call.
6. Keep Unity LevelPlay production mediaton and store settings unchanged. PR #2 stays Draft, never merge automatically.

**N11_PROXY_MANIFEST_AUDIT=PASS; N11_ACTUAL_API37=NOT_VERIFIED; SDK_INSTALL=HOLD; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE.**
