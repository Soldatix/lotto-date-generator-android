# Date Lotto Android: N5 portrait rail and CMP assessment

Status: N5 Android layout experiment; not production, no real ads,
no CMP dependency and no LevelPlay SDK initialization.
PR #2 stays Draft; REAL_ADS=OFF; PRODUCTION_NO_GO=TRUE.

## 1. Problem: 320dp banner cannot fit 298dp card

Unity LevelPlay Android SDK standard banner is 320x50 dp, LARGE 728x90 dp.
Unity's adaptive size is DEVICE-width based, not right-panel-width based.
The Huawei portrait right panel's in-card HTML reservation measured about
298 CSS px / Android dp; N4 correctly rejects a 320dp standard banner
rather than scaling, cropping or allowing overlap.

## 2. N5 proposed narrow-tablet layout (debug only)

A third explicit boolean ADB Intent extra is required IN ADDITION to
both already-reviewed N1 flags:
- org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE=true
- org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW=true
- org.appsandgames.datelottogenerator.DEBUG_N5_PORTRAIT_RAIL=true

Exact isolated debuggable package and native existing safety guards
remain mandatory. Ordinary N1/N2 launches remain unchanged.

Portrait: move the ONE existing hidden-until-debug HTML mock out of
the 298dp right card into a normal-flow full-width grid row BELOW
both cards. Reserve exactly 320 CSS px width and 50 CSS px height
when there is enough available width. If the grid is narrower than
320 CSS px, hide the mock instead of squeezing it.

Landscape: return the existing mock to the right panel, after
generated result and saved history. Rotation/resize handlers update
the location. Native N1 TestView uses the same verified WebView DOM
bounds and hides when outside the viewport, covered by the soft
keyboard or crossing Android window safe frame.

This candidate can be below the initial portrait viewport; users
may have to scroll. It must never become a sticky system-navigation
overlay or replace generated results. It is a *no-ad mock*, not a
native SDK banner or an ad request.

Automated Chromium tests use the ACTUAL JS extracted from the
Kotlin Android debug host and test 640x1024 portrait, 1024x640
landscape, 480x800 portrait and 300x650 too-narrow fallback.
A future real-device test of this THIRD opt-in requires its own
explicit gate and proof; earlier N1/N2 device PASS does not imply
N5 portrait rail physical PASS.

## 3. CMP candidate assessment (provider not chosen)

Candidate A (preferred only if AdMob/Google demand is planned):
Google's certified CMP configured in AdMob and integrated via
Google User Messaging Platform (UMP). UMP requires a configured
AdMob app ID and privacy messaging. Its Android workflow refreshes
consent information at EVERY launch, displays required consent
forms, supports a privacy-options entry point when required, and
checks canRequestAds before making eligible requests. Unity says
that supported TCF CMP information, including Google UMP, can
propagate to LevelPlay and compatible mediated partners. Account
prerequisites, demand sources and legal/policy requirements MUST
be verified before selecting this provider.

Candidate B (conditional alternative): a Google-certified,
app-capable third-party CMP, for example Usercentrics or Iubenda,
if integration requirements or account setup make it more
appropriate. Verify current Google app certification, IAB TCF,
Additional Consent and mediated vendor support, pricing,
Android integration, supported languages and withdrawal UI.
Do not select based solely on certification.

Google's CMP requirements cover Google publisher ad delivery
in the EEA, UK and Switzerland. Compliance for non-Google
partners and other jurisdictions also needs review. A CMP
button or SDK consent boolean alone does not establish lawful
user choice. Explicitly audit network vendor roster, SDK data
collection, Android privacy disclosures, children's audience
status, regional notices and non-consent paths.

Open dependencies BEFORE any active integration:
1. Confirm whether an AdMob app ID exists for the pilot app
   and whether Google demand is actually configured in LevelPlay.
2. Confirm mediation partner/adapter roster and TCF/Additional
   Consent coverage, including local legal/policy requirements.
3. Choose and configure a CMP in its publisher dashboard.
4. Provide persistent and discoverable privacy options and
   withdrawal, and update status every app launch.
5. Separate SDK/advertising activation review and approval.

N4ConsentGateDraft remains disabled and evidence-only.
CMP_PROVIDER=UNDECIDED. No ad SDK init, no user-data flow,
no real ad requests, no app keys, no package/release change.

Official sources reviewed 2026-11-06:
Unity Android banner:
https://docs.unity.com/en-us/grow/levelplay/sdk/android/banner-integration
Unity CMP guidance:
https://docs.unity.com/grow/levelplay/platform/legal-resources/ironsource-gdpr-compliance
Google AdMob certified CMP requirement:
https://support.google.com/admob/answer/13554116
Google Android UMP:
https://developers.google.com/admob/android/privacy
