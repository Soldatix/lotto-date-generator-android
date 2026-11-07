# N9 — Date Lotto Android / Google UMP + Unity LevelPlay banner review (NO ADS)

**Status:** GitHub PR #2 Draft; review-only source and CI; NO SDK-enabled APK built/installed; `REAL_ADS=OFF`, `PRODUCTION_NO_GO=TRUE`.

## Confirmed device evidence kept intact

- Huawei CMR-W09 Android 9: N5 native anchored *blue no-ad view* follows the HTML result slot in landscape and portrait (portrait rail).
- N7: real published AdMob Google UMP GDPR message displays in Croatian on Huawei; consent callback refresh completed without error.
- N8: isolated UMP-only debug APK displays privacy/options UI; rejecting the consent dialog returns to the activity and reopening privacy options is visually confirmed.
- N8 `canRequestAds() = true` is **not** proof of affirmative consent for personalised advertising or all enabled vendors. Persisted vendor/choice state and Huawei's enrollment as a Unity LevelPlay test device are not independently verified.

## What N9 adds

- Separate `-PappsGamesN9ConsentBannerReview=true` Gradle debug-review classpath, exclusively in the isolated `.levelplaypilot` package. The existing N7-only and SDK-only flags remain separate and cannot be used together with N9.
- Requires a locally provided Android AdMob App ID through `APPSGAMES_N7_ADMOB_APP_ID`, never committed to GitHub.
- Combines **Google UMP 4.0.0** and **Unity LevelPlay 9.5.0** for *compilation/review only*. LevelPlay/AdQuality may have collection or startup side effects merely when installed; therefore **do not build/install or run this combined variant** until the publisher reviews privacy and explicitly approves the device test.
- `N9ConsentBannerReview.kt` reads only UMP readiness and privacy-options availability; it does not itself request consent, and it does not infer affirmative partner consent from `canRequestAds()`.
- The native banner placement candidate uses the existing N5/N4 visible-area boundaries and a **full unscaled 320×50 dp LevelPlay banner**, hiding the candidate if the slot does not fit. N5 geometry is unchanged.
- A refusal/withdrawal immediately invalidates the review candidate and marks all requests forbidden. Even **fully positive fake evidence** cannot unlock a request: `N9_REAL_TEST_AD_REQUESTS_APPROVED=false` plus a second unconditional false safety stop.
- Existing `LevelPlaySdkBannerDraft.APPROVED_AD_REQUESTS=false`, `N4ConsentGateDraft` and `N6AdMobReadinessGate` hard stops remain intact.
- No `LevelPlay.init()`, `LevelPlayBannerAdView()`, `loadAd()`, `setGDPRConsent()`, ad network requests, ad ID reads, Android `MainActivity` changes, `main` merges, releases or production package changes are authorized or performed.

## CI and next physical test prerequisites

The CI Android Kotlin library copies/compiles N9 with the existing SDK drafts against the pinned AAR and runs pure JVM refusal/withdrawal checks; it produces **no APK**. Web/PWA Node tests enforce Gradle isolation, secrets exclusion, and no-request guards.

Before any future real **TEST** banner, in order:

1. Verify Huawei CMR-W09 is specifically enrolled as a LevelPlay test device; OPPO registration is not enough. Reactivate time-limited test-network mode in Unity as needed.
2. Review the actual mediated-network list and UMP Additional Consent requirements. Handle Google UMP `canRequestAds` separately from purposes/vendor choices. Review audience classification, existing privacy policy, and AdQuality/SDK privacy behavior.
3. Implement an owner-approved, fail-closed UMP callback-to-SDK consent handoff and Privacy options in the actual Android UI; ensure withdrawal tears down the native banner, prevents refreshing/reinitializing and stops new requests.
4. Connect the existing N5 NativeAnchoredBannerProbe listener to the LevelPlay view without resizing or overlapping Copy/Save/navigation. Do not activate the SDK from `MainActivity` on normal launches.
5. Review the complete merged AndroidManifest and dependency behavior of the combined test APK, then request **separate explicit authorization** to enable test-device-only ad requests, with private local keys and verified debug package.
6. Test Huawei first, then OPPO if needed. Production/store changes require their own separate approval.

Official documentation:
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/banner-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/regulation-advanced-settings
