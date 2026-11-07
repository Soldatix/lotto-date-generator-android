# Date Lotto Generator Android — N6 AdMob + Google UMP safe preparation

Date: 2026-11-06
Repo: Soldatix/lotto-date-generator-android
PR #2: Draft, base main, no merge.
N6 mode: compile-only, no APK/AAB, no AdMob or LevelPlay runtime, no CMP network calls.
REAL_ADS=OFF; SDK_INIT=OFF; PRODUCTION_NO_GO=TRUE.

## Verified Google/Unity requirements

1. Official Google Android UMP documentation currently uses
   com.google.android.ump:user-messaging-platform:4.0.0 and Android API 21+.
   Source: https://developers.google.com/admob/android/privacy
2. A publisher must create Privacy & messaging configuration in AdMob and
   configure the app's real AdMob application ID in the approved future
   Android manifest. N6 intentionally does neither.
3. Request an update of consent information at each launch with
   requestConsentInfoUpdate, show required forms with
   loadAndShowConsentFormIfRequired, and provide an accessible privacy-options
   entry when the UMP status says it is required. Before any ad request,
   query canRequestAds. Its TRUE value may reflect a prior session; it is
   not a blanket license for every mediation partner or legal jurisdiction.
   Do not double-request ads from multiple callbacks. Support refusal and
   withdrawal. Never hard-code consent=true.
4. Unity LevelPlay supports sharing compatible IAB TCF consent information
   from Google UMP and other supported CMPs with relevant mediated networks.
   Verify the demand/adapter roster and Google Additional Consent partner
   list before enabling any network.
   Source: https://docs.unity.com/grow/levelplay/platform/legal-resources/ironsource-gdpr-compliance
5. Google AdMob permits setting up an UNPUBLISHED app for preparation.
   An app needs public listing in a supported store and successful review
   before full serving. OPPO App Market is a supported third-party store.
   Source: https://support.google.com/admob/answer/9989980

## Current external readiness (NOT ASSUMED)

- OPPO individual developer verification: still "Approving" per latest user
  report, reminder emailed on 2026-11-06. No confirmation received here.
- AdMob account: EXISTS, account approval PENDING at last user dashboard check.
- AdMob Android app "Date Lotto Generator": CREATED (unpublished).
- Android AdMob App ID: available from the user's dashboard; intentionally
  not embedded in source, manifests or logs.
- Android AdMob European regulations message: created, saved as DRAFT
  (not demonstrated as published). Separate from AdSense website CMP.
- Google demand and all LevelPlay mediated partners: NOT VERIFIED.
- Privacy notice/age audience options: NOT VERIFIED for ads.
- Google Play or OPPO public app listing: NOT VERIFIED.
- Unity LevelPlay Android app and Banner unit already CREATED. OPPO Find X5
  Lite registered for Unity test ads. Unity key and Banner ID are held
  outside public source. Google UMP test registration is a separate system.
- No publisher keys, IDs, consent strings or test-device hashes are committed
  to the Android source.

## N6 actual implementation

1. An optional Android-only UMP 4.0.0 dependency is added strictly inside
   the existing LevelPlay SDK pilot Gradle opt-in. Ordinary debug, release,
   production, Windows and Web builds exclude it. The disposable CI library
   resolves both Unity LevelPlay 9.5.0 and Google UMP 4.0.0 only for Kotlin
   compilation. No APK/AAB is built by CI.
2. N6UmpConsentApiDraft.kt is compiled in the optional LevelPlay pilot
   source set to confirm the current official UMP API signatures. The
   class is not referenced by MainActivity. Two independent constants,
   N6_UMP_RUNTIME_APPROVED=false and
   N6_ADMOB_CONFIGURATION_APPROVED=false, block all UMP calls.
   No SDK initialization, consent form, ID read, data collection, or
   privacy-options presentation happens at runtime.
3. N6AdMobReadinessGate.kt is a pure offline checklist. All external
   conditions default false. It separates preparation requirements
   from public store/release approval requirements; an unpublished app
   may be created before OPPO approves the developer account. Its
   canInitializeSdkOrRequestAds() always returns false due to a separate
   N6_RELEASE_AND_AD_REQUESTS_APPROVED=false gate, even for a positive
   synthetic checklist.
4. LevelPlaySdkBannerDraft.kt still has APPROVED_AD_REQUESTS=false and
   the N4 CMP hard stop, plus an independent N6 readiness hard stop.
   The real Unity SDK remains completely uninitialized; no ad requests.
5. Node source guards verify the production main manifest has no AdMob
   app ID and MainActivity has no UMP call; SDK dependencies are opt-in
   only. Offline JUnit tests cover missing AdMob/OPPO/store approvals,
   a complete mock still being prohibited, and partner/withdrawal review.
   All tests are CI-only.

## Recommended next user actions (account-side only; no code changes)

- Confirm whether an AdMob account already exists. If not, the user can
  create one via https://admob.google.com after reviewing Google's
  account verification/terms. Connector or account setup requires
  the user's own explicit action; N6 does not sign up on their behalf.
- For a preparatory AdMob app setup, select Android and "No" when asked
  whether the app is in a supported store, until it is public.
  Use the final PROD app identity; NEVER link the isolated
  ".levelplaypilot" debug identity as the public app.
- Review Privacy & messaging for the relevant supported CMP and TCF
  vendor list (including AdMob, ironSource, Unity and any later networks).
- After OPPO approves and the app is published, link the matching public
  OPPO store entry to AdMob and complete its review.
- Plan privacy-policy text, age-audience review, withdrawal/privacy
  options entry, and platform disclosures before real SDK activation.
- Future active CMP test would be separately approved in a disposable
  package using no real ad requests. Its UI must be verified on Huawei
  and OPPO before any broader rollout.

N1/N2/N5: Huawei no-ad native layout visually verified.
N3/N4/N6: integration architecture / compile-only phases only.
No production change, no current ad requests, no consent collection.
