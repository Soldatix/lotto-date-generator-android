# N10 — Google UMP / N5 Native Anchor / LevelPlay bridge (NO ADS)

Status: **REVIEW / COMPILE ONLY**, PR #2 Draft, never install an SDK-enabled APK without separate review. `REAL_ADS=OFF`, `PRODUCTION_NO_GO=TRUE`.

## Confirmed prior facts (do not retest unnecessarily)
- N5: Huawei CMR-W09 Android 9 has a native no-ad banner overlay aligned safely in landscape and portrait, with a separate portrait rail. This proves a placement, not advertising.
- N7: real Croatian Google UMP form and per-launch refresh passed on the same tablet.
- N8: UMP options can reopen after refusing, and the UI returned to the debug Activity.
- N9: compile-only Google UMP 4.0.0 and Unity LevelPlay 9.5.0 sources in mutually exclusive N9 debug-only Gradle mode; no SDK runtime or test ad request.
- Unity LevelPlay dashboard now lists two registered test devices, including **Huawei_MediaPad_M5_Test**, with **ironSource Bidding → Banner** selected for Huawei. The `Test ads` action has **not** been activated. Do not store either device's advertising ID in source or diagnostics.

## N10 source implementation
- `N10FailClosedSession.kt` is a pure deterministic runtime state machine with phases `UNCHECKED`, `REFRESHING`, `FORM_PENDING`, `REVIEW_ONLY`, `FAILED`, `WITHDRAWN`, `CLOSED`.
- UMP `canRequestAds()` is recorded only as a **reported readiness** value and never as proof of affirmative personalised-ad consent.
- Consent-info refresh and form completion must both succeed; errors hide the proposed native slot and fail closed.
- An explicitly user-triggered privacy-options open hides any prior placement immediately. Any privacy-options dismissal conservatively invalidates the prior permission, because the callback alone does not report per-vendor acceptance. A later explicit review must determine the true consent state.
- Monotonic generations reject stale callbacks after a new check, withdrawal or Activity destruction; no cached TCF/consent strings, identifiers or vendor flags are logged or persisted.
- Existing N5/N4 320×50dp geometry rules are reused for candidate placement without resizing creative. Pausing, off-screen position, or invalid slot hides it.
- `N10UmpNativeCoordinator.kt` implements the actual UMP API call sequence and the `NativeBannerAnchorListener` contract. It is a **review-only, non-instantiated** component: `N10_UMP_RUNTIME_APPROVED=false` and `N10_N5_SDK_HANDOFF_APPROVED=false`. Neither N8 nor `MainActivity` calls it. The N3 native anchor listener registration is also still hard-disabled.
- `N10FailClosedSession` contains independent permanent `N10_SDK_INIT_APPROVED=false` and `N10_TEST_AD_REQUESTS_APPROVED=false`; snapshot always reports both false (even with all synthetic positive CMP values).
- No Unity SDK init, `LevelPlayBannerAdView` creation or `loadAd()` calls. The separate existing `LevelPlaySdkBannerDraft.APPROVED_AD_REQUESTS=false` remains unchanged.
- A disappearing banner anchor is **not** interpreted as the user withdrawing privacy consent. Explicit `onConsentRevoked()` is separate and fail-closed.

## Test status and next steps
- GitHub Actions disposable compile-only harness copies N10 source into its own Android library and compiles it against actual UMP + Unity SDK AARs. JUnit tests cover reported UMP readiness, successful form callback, consent withdrawal, stale callback rejection, race/reentrant controls, invalid N5 placement, pause and destruction. No APK/AAB or device-side SDK execution.
- Full application source and production/default Android dependencies are unchanged. The N9 source-set opt-in still excludes release/publish/bundle.
- **Remaining before a real test banner:** inspect final merged Android manifest and AdQuality SDK startup/privacy behavior; verify actual Unity adapters and dashboard banner configuration; complete consent partner/purpose semantics, data-safety/audience review; approve one isolated debug APK and a separate explicit, time-limited Huawei `Test ads` request; only then wire the native N5 listener and the real SDK view teardown. Any failure must keep `PRODUCTION_NO_GO=true` and `REAL_ADS=OFF`.

Official references:
- Google UMP: https://developers.google.com/admob/android/privacy
- Unity Android integration: https://docs.unity.com/en-us/grow/levelplay/sdk/android/sdk-integration
- Unity Android banners: https://docs.unity.com/en-us/grow/levelplay/sdk/android/banner-integration
- Unity privacy settings: https://docs.unity.com/en-us/grow/levelplay/sdk/android/regulation-advanced-settings
