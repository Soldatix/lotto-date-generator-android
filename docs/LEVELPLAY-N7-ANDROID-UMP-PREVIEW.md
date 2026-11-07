# Android Date Lotto Generator N7 — Google UMP form-only preview (NO ADS)

**State:** REVIEW-ONLY, GitHub PR #2 Draft, 2026-11-07.
No APK is produced by the GitHub compile-only workflow.

## Real Android banner goal

- Unity LevelPlay Android app and **Banner** ad unit already exist.
- Owner registered OPPO Find X5 Lite as a Unity LevelPlay test device
  and enabled ironSource Bidding Banner test ads earlier.
- Google **AdMob Android** app "Date Lotto Generator" exists; account
  verification was still pending when last inspected. The Android
  AdMob GDPR/UMP message is DRAFT, and needs publisher review/publishing
  before a real UMP form can be shown. The AdSense **website** GDPR
  message is a different product and cannot substitute for Android UMP.
- OPPO developer account approval is separately pending.
- Unity App Key, Unity Banner Ad Unit ID and Android AdMob App ID have
  already been obtained by the owner; **do not ask to register again**.
  Never commit those IDs to public GitHub in this pilot.

## What is now implemented

- A completely separate `-PappsGamesN7UmpPreview=true` mode for a
  **disposable DEBUG APK**. Normal release and debug builds are unchanged.
- Adds **only** Google UMP 4.0.0, not LevelPlay or AdQuality.
  The N7 Gradle mode explicitly rejects simultaneous
  `-PappsGamesLevelPlaySdkPilot=true`.
- Injects the Android AdMob App ID into the N7 debug manifest from a
  local-only environment variable `APPSGAMES_N7_ADMOB_APP_ID`.
  It fails before building if the ID is missing or malformed.
- Adds a debug-only exported `N7UmpPreviewActivity` that checks the
  exact `org.appsandgames.datelottogenerator.levelplaypilot` package,
  `FLAG_DEBUGGABLE` and a second explicit ADB Intent extra:
  `org.appsandgames.datelottogenerator.DEBUG_N7_UMP_PREVIEW=true`.
- Performs Google UMP's per-launch `requestConsentInfoUpdate`, then
  `loadAndShowConsentFormIfRequired`. No LevelPlay SDK init, no banner,
  no ad request, no GAID read, no local log of IDs/consent strings.
  This is a diagnostic consent form only, not a final production UI.
- The N6/LevelPlay branch and the tested N1/N5 native no-ad banners
  remain untouched. All prior permanent request blockers stay FALSE.

## Exact next gates

1. In **AdMob** (not AdSense) open the Android app Date Lotto Generator,
   `Privacy & messaging > European regulations > Messages`.
   Verify the app's **Android GDPR message** and privacy policy, audience
   and partner coverage; after review, the owner may publish that
   message. Publishing the message does not by itself activate ads in
   any app that does not use UMP.
2. The user must explicitly approve a one-time N7 isolated UMP
   consent-network/form test, since this preview makes a real call
   to Google's consent service (although **not** to an ad server).
3. For device build on Windows, set the real Android AdMob App ID as a
   private process environment variable, then use a clean isolated
   worktree, compile DEBUG with only N7 flag, verify the exact pilot
   package and inspect merged manifest before installing.
4. Start activity explicitly by ADB:
   `am start -n org.appsandgames.datelottogenerator.levelplaypilot/.N7UmpPreviewActivity --ez org.appsandgames.datelottogenerator.DEBUG_N7_UMP_PREVIEW true`.
   Check generic `DateLottoN7UMP` logs, form and privacy choices.
5. Implement the production-grade Settings privacy-options action,
   verify refusal and withdrawal, and review mediation vendor consent.
6. **Only then** request a separately approved Unity LevelPlay test
   banner using the existing key/unit, test-device configuration
   and N1/N5 placement, never a live production ad.

Official Google UMP documentation:
https://developers.google.com/admob/android/privacy

Unity LevelPlay test device documentation:
https://docs.unity.com/en-us/grow/levelplay/sdk/android/integration-testing

**REAL_ADS=OFF; N7_DEFAULT=OFF; PRODUCTION_NO_GO=TRUE**.
