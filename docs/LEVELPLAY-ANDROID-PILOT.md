# Unity LevelPlay Android banner — isolated pilot (2026-11-04)

**STATUS: DRAFT / PRODUCTION NO-GO — MOCK ONLY. NO SDK, no ad requests, no tracking, no changes to the published Android release.**

## Application reality

This repository is the **Date Lotto Generator v1.0.1** built with Tauri 2 (Vite/JavaScript interface in a WebView, `TauriActivity` Kotlin entry in `src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt`). It is **not** a fully native Kotlin UI. Package ID: `org.appsandgames.datelottogenerator`.

Unity LevelPlay's **native Android SDK** can be integrated via the Android Gradle/Kotlin layer. It is not safe to insert an HTML ad banner script inside the Tauri WebView and assume the native SDK can render there. The eventual native LevelPlay banner view needs an Activity-controlled ViewGroup and lifecycle coordination with the Tauri WebView. The generated `activity_main.xml` is currently a placeholder; do not assume this layout is Tauri's displayed content or replace the Activity root without verifying the runtime.

## What is implemented

- `src/js/levelplay-pilot.js`: an isolated, visual 320×50 dummy, with EN/HR/DE/IT/ES explanations and two nonpersistent demonstration choices. No SDK imports, no network calls, no privacy state storage.
- `index.html`: one hidden `#levelPlayPilot` region under the generator cards, outside the number and action fields, before the footer.
- `src/styles/main.css`: responsive placement and accessible buttons.
- `src/main.js`: initializes the visual mock, but only if ALL conditions hold: URL parameter `?levelPlayPreview=1`, Tauri environment, **Android** user agent. A standard browser/PWA and Windows Tauri do not display it. In normal Android app launch it is hidden too.
- `tests/levelplay-pilot.test.mjs` and `ci/levelplay-pilot-smoke.mjs`: static and Playwright checks. Simulated `window.__TAURI_INTERNALS__` in CI is **not a real Android device test**.

## Next implementation phase — not yet authorized for production

1. Create/access Unity LevelPlay publisher project for **Android** package `org.appsandgames.datelottogenerator`; obtain the **app key** and a **Banner ad unit ID**. Do not commit private dashboard identifiers or credentials; store any sensitive configuration securely. Do not create fake IDs.
2. Choose just **one mediation manager** (LevelPlay). Initially connect Unity Ads or another eligible supported ad network. AppLovin MAX should not also mediate the same banner.
3. Define an appropriate consent and privacy flow before SDK initialization, including applicable GDPR/EEA/Swiss requirements and Play Data Safety declarations. The test Allow/Reject buttons are **not** consent. Unity LevelPlay 9.5.0+ uses `LevelPlayPrivacySettings.setGDPRConsent(boolean)` before SDK initialization, but this API alone is **not** a legally adequate CMP. Consider approved CMP behavior and network-specific data processing.
4. Review Android permissions, SDK initialization and automatic AdQuality, data collection, mediation adapters and Play Store declarations **before adding any dependency**. Official SDK setup currently lists `com.unity3d.ads-mediation:mediation-sdk:9.5.0`; we intentionally have **not** added it.
5. Implement a Kotlin/Android native banner host attached to the **actual** Tauri Activity view hierarchy (not the unused placeholder layout). After an appropriate consent decision, initialize LevelPlay and create a native `LevelPlayBannerAdView`, use `LevelPlayAdSize.BANNER` (320×50 dp) or documented adaptive size, attach it to native host, configure listeners, and call `loadAd()`. Ensure ad is never placed over interactive lotto controls. Cleanup through `destroy()`, pause/resume refresh as appropriate, and handle withdrawal/restart without treating DOM removal as cookie deletion.
6. Test with **registered test devices** using Unity's LevelPlay test mode and Integration Test Suite. Validate Android build, screen dimensions, portrait/landscape, offline, consent denial/revocation and actual Tauri lifecycle before any store update.
7. Explicit release approval required; prepare Google Play `Contains ads` and Data Safety, privacy policy, and versionCode/versionName review. Keep user testing strictly nonproduction until approved.

## Verification and rollback

The original `main` branch remains unchanged. PR is Draft. A static/mock test passing is not evidence that the actual Unity SDK loads, that banner inventory exists, that mediation is approved, or that revenue is generated.

Source references:
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/sdk-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/banner-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/regulation-advanced-settings
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/integration-testing
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/networks/guides/unity-ads
