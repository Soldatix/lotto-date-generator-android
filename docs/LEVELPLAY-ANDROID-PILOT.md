# Unity LevelPlay Android banner — isolated pilot (2026-11-04)

**STATUS: DRAFT / PRODUCTION NO-GO — SDK GRADLE OPT-IN AND DORMANT KOTLIN ADAPTER ONLY. No automatic SDK loading, no ad requests, no tracking by our code, no changes to the published Android release.**

## Application reality

This repository is the **Date Lotto Generator v1.0.1** built with Tauri 2 (Vite/JavaScript interface in a WebView, `TauriActivity` Kotlin entry in `src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt`). It is **not** a fully native Kotlin UI. Package ID: `org.appsandgames.datelottogenerator`.

Unity LevelPlay's **native Android SDK** can be integrated via the Android Gradle/Kotlin layer. It is not safe to insert an HTML ad banner script inside the Tauri WebView and assume the native SDK can render there. The eventual native LevelPlay banner view needs an Activity-controlled ViewGroup and lifecycle coordination with the Tauri WebView. The generated `activity_main.xml` is currently a placeholder; do not assume this layout is Tauri's displayed content or replace the Activity root without verifying the runtime.

## What is implemented

- `src/js/levelplay-pilot.js`: an isolated, visual 320×50 dummy, with EN/HR/DE/IT/ES explanations and two nonpersistent demonstration choices. No SDK imports, no network calls, no privacy state storage.
- `index.html`: one hidden `#levelPlayPilot` region under the generator cards, outside the number and action fields, before the footer.
- `src/styles/main.css`: responsive placement and accessible buttons.
- `src/main.js`: initializes the visual mock, but only if ALL conditions hold: URL parameter `?levelPlayPreview=1`, Tauri environment, **Android** user agent. A standard browser/PWA and Windows Tauri do not display it. In normal Android app launch it is hidden too.
- `tests/levelplay-pilot.test.mjs` and `ci/levelplay-pilot-smoke.mjs`: static and Playwright checks. Simulated `window.__TAURI_INTERNALS__` in CI is **not a real Android device test**.

## Android SDK scaffold added in PR #2 (2026-11-05)

The LevelPlay dashboard app and banner are now registered by the owner. A single network, **ironSource Bidding**, has a Banner instance. Test device **OPPO Find X5 Lite** is enrolled under `DateLotto_Test_Android`. Because test-network configuration is time-limited, reactivate it at actual device-test time. **Do not add the registered device's Advertising ID to GitHub**. The owner already has both the App Key and Ad Unit ID in their private dashboard; no identifiers are stored in Kotlin or Gradle.

- `src-tauri/gen/android/app/build.gradle.kts`: optional, pinned `com.unity3d.ads-mediation:mediation-sdk:9.5.0` dependency. **Not included by default**. Requires manual `-PappsGamesLevelPlaySdkPilot=true` to resolve SDK in a disposable debug build. Release/publish tasks are rejected if the flag is set. The optional Kotlin source folder `src/levelplayPilot/java` is excluded by default.
- `src-tauri/gen/android/app/src/main/java/.../LevelPlayBannerHost.kt`: inactive native `FrameLayout` host. Its manually called helper reserves a 50dp strip below the Tauri WebView by inserting a vertical layout; it **is not invoked** by `MainActivity`. Tauri view hierarchy, system insets and keyboard interaction **must** be checked on physical device before calling this method.
- `src-tauri/gen/android/app/src/levelplayPilot/java/.../LevelPlaySdkBannerDraft.kt`: candidate Kotlin SDK init, privacy flag, 320x50 banner lifecycle and cleanup (using verified Unity Android API namespace `com.unity3d.mediation`). **Second immutable guard `APPROVED_AD_REQUESTS = false` blocks SDK initialization even when the optional dependency is included.** Neither this class nor its host is called by `MainActivity`.
- `tests/levelplay-native-sdk-guard.test.mjs`: asserts the Gradle opt-in, hard stops, absence of keys and no automatic native attachment.

**Very important:** SDK `9.5.0` includes AdQuality, and a dependency's presence alone may have data-collection implications. The default app has **neither** the SDK nor this new optional Kotlin source. The SDK-enabled disposable debug variant must be audited before installing it. A simulated Chromium suite does **not** compile Kotlin or validate real Tauri view hosting; a physical Android debug build and device testing still remain necessary.

**Required implementation work remaining:** legally reviewed CMP with native consent bridge, conditional lifecycle attachment after verification, integration tests against the real AAR (native Kotlin compile), final ad network adapters, Google Play Data Safety updates, screenshots of tested display and withdrawal. No advertising network requests should be made until all conditions are satisfied. No real banner revenue is being generated.

**Build note (developer-only / opt-in, NOT yet a tested command):** the property `appsGamesLevelPlaySdkPilot=true` enables optional SDK dependency and Kotlin source set for a disposable debug build. This does *not* enable ad requests. Never apply it to release/publish tasks and never check in real IDs or consent records.

## Next implementation phase — not yet authorized for production

1. Create/access Unity LevelPlay publisher project for **Android** package `org.appsandgames.datelottogenerator`; obtain the **app key** and a **Banner ad unit ID**. Do not commit private dashboard identifiers or credentials; store any sensitive configuration securely. Do not create fake IDs.
2. Choose just **one mediation manager** (LevelPlay). Initially connect Unity Ads or another eligible supported ad network. AppLovin MAX should not also mediate the same banner.
3. Define an appropriate consent and privacy flow before SDK initialization, including applicable GDPR/EEA/Swiss requirements and Play Data Safety declarations. The test Allow/Reject buttons are **not** consent. Unity LevelPlay 9.5.0+ uses `LevelPlayPrivacySettings.setGDPRConsent(boolean)` before SDK initialization, but this API alone is **not** a legally adequate CMP. Consider approved CMP behavior and network-specific data processing.
4. Review Android permissions, SDK initialization and automatic AdQuality, data collection, mediation adapters and Play Store declarations **before enabling the optional SDK dependency**. Official SDK setup lists `com.unity3d.ads-mediation:mediation-sdk:9.5.0`; the test branch includes it conditionally but default builds do not resolve it.
5. Implement a Kotlin/Android native banner host attached to the **actual** Tauri Activity view hierarchy (not the unused placeholder layout). After an appropriate consent decision, initialize LevelPlay and create a native `LevelPlayBannerAdView`, use `LevelPlayAdSize.BANNER` (320×50 dp) or documented adaptive size, attach it to native host, configure listeners, and call `loadAd()`. Ensure ad is never placed over interactive lotto controls. Cleanup through `destroy()`, pause/resume refresh as appropriate, and handle withdrawal/restart without treating DOM removal as cookie deletion.
6. Test with **registered test devices** using Unity's LevelPlay test mode and Integration Test Suite. Validate Android build, screen dimensions, portrait/landscape, offline, consent denial/revocation and actual Tauri lifecycle before any store update.
7. Explicit release approval required; prepare Google Play `Contains ads` and Data Safety, privacy policy, and versionCode/versionName review. Keep user testing strictly nonproduction until approved.

## Real LevelPlay SDK Kotlin compile evidence (2026-11-05)

- **PASS:** [GitHub Actions SDK Kotlin compile-only run #42031868374](https://github.com/Soldatix/lotto-date-generator-android/actions/runs/42031868374). Gradle 9.6.1 executed `compileDebugKotlin` against the real `com.unity3d.ads-mediation:mediation-sdk:9.5.0` AAR. Output included `> Task :compileDebugKotlin` and `BUILD SUCCESSFUL`. Both `LevelPlayBannerHost.kt` and `LevelPlaySdkBannerDraft.kt` compiled without Kotlin errors.
- The initial attempt failed because GitHub's Android SDK manager did not offer `platforms;android-37`; the **isolated CI project uses API 36** instead. This does NOT change the actual Tauri app's `compileSdk = 37`; a real Android build must verify the toolchain/API 37 separately.
- The CI harness lives in `ci/android-levelplay-compile/` and the dedicated `.github/workflows/levelplay-android-kotlin-compile.yml`. It builds a disposable Android *library compile target*, **no APK/AAB**, does not run the LevelPlay SDK or call Adsterra/Unity ad endpoints, and does not install on a device.
- The full Tauri Android debug build, real Android window hosting, screen insets, runtime consent, SDK/AdQuality data behavior, and OPPO device tests **remain unverified**. No SDK-enabled APK should be distributed or installed before privacy review.
- Added Windows read-only environment preflight `scripts/LevelPlay-Android-Preflight-ReadOnly.ps1`. It checks Git branch, Kotlin hard stop, Java, Node, SDK API availability and authorized ADB device *count* without printing Advertising IDs or installing anything. Running `adb devices` may start the local ADB server.

## Separate installable debug APK identity — 2026-11-05

The **full Android/Gradle compiler-only run against local API 37** passed on the developer's PC. Gradle returned \`BUILD SUCCESSFUL\`, \`GRADLE_EXIT_CODE=0\`, \`LEVELPLAY_KOTLIN_COMPILE=PASS\`; no APK was built in that run.

For the *next* stage, only the Draft PR branch now uses the supported Tauri setting:
- \`src-tauri/tauri.conf.json\` → \`bundle.android.debugApplicationIdSuffix = ".levelplaypilot"\`
- \`src-tauri/gen/android/app/build.gradle.kts\` → matching \`buildTypes.debug.applicationIdSuffix = ".levelplaypilot"\` for Android Studio direct builds. The release \`defaultConfig.applicationId\` remains \`org.appsandgames.datelottogenerator\`.
- **Production Android ID**: \`org.appsandgames.datelottogenerator\`
- **Isolated Debug Android ID**: \`org.appsandgames.datelottogenerator.levelplaypilot\`
- \`src-tauri/gen/android/app/src/debug/res/values/strings.xml\` overlays the launcher and Activity label to show **Date Lotto - LP TEST** in debug builds. Release resources remain unchanged.

**Important**: This is not yet proof that the full Tauri Android build will succeed. The Tauri CLI may rewrite generated Android files. Additionally, a recent [Tauri bug report](https://github.com/tauri-apps/tauri/issues/15561) noted possible misplacement of debug suffix when a \`signingConfigs.debug\` block is present. Our current Gradle file has the correctly scoped \`buildTypes.getByName("debug")\` stanza, and the actual APK package is verified as an independent gate before install.

\`scripts/LevelPlay-Android-Safe-DebugBuild.ps1\` performs an optional **NO-INSTALL**, local ARM64 \`--debug --apk\` Tauri build in the already-isolated GitHub pilot checkout. It validates Git branch and worktree, static package configuration and privacy hard stops; refuses globally-enabled ad SDK; invokes \`npm ci\`, then \`npm run tauri -- android build --debug --apk --ci --target aarch64\`; afterwards reads the **actual built APK ID** via Android build-tools \`aapt dump badging\`, and refuses any APK with a package ID different from \`org.appsandgames.datelottogenerator.levelplaypilot\` or an unexpected app label. It produces an APK on the Windows PC only: **it never runs ADB install, starts any app, merges PR, creates release, or sends real ad requests**.

The default debug build DOES NOT include the LevelPlay SDK. There is an independent, opt-in SDK-compile scaffold in the Gradle file but it stays off, and native \`APPROVED_AD_REQUESTS = false\` remains unchanged. If the debug APK builds successfully, a separate human-reviewed install step must verify signature, package ID and absence of changes to the existing production app; do not run Android Studio's automatic Run/Install before that.


## Verification and rollback

The original `main` branch remains unchanged. PR is Draft. A static/mock test passing is not evidence that the actual Unity SDK loads, that banner inventory exists, that mediation is approved, or that revenue is generated.

Source references:
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/sdk-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/banner-integration
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/regulation-advanced-settings
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/integration-testing
- https://docs.unity.com/en-us/grow/levelplay/sdk/android/networks/guides/unity-ads


## Huawei Android 9 root hierarchy finding and safe-margin host candidate (2026-11-05)

Physical CMR-W09 result from the **SDK-free** test APK SHA-256
`539FA3095178A1EDE616243C1626BDEAC440F92958F8D2A35914DE47765D2C46`:
native test placeholder **not** displayed. Explicit ADB launch and focused Android
logcat produced `HOST_PROBE=ROOT_SHAPE_UNSUPPORTED`. The test app itself ran.
This is the expected failure of the old `content.childCount != 1` assumption,
or another root-shape guard, **not** a mediation SDK failure.

The next pilot candidate keeps existing Android `android.R.id.content`
children in place. It reserves a 50dp area by temporarily adjusting the
bottom margins of those FrameLayout children and adds an independent
bottom-gravity Android FrameLayout for a 320x50dp **NO ADS** label.
The exact original layout-parameter objects are saved and restored on release.
If any existing child is not compatible, it fails closed without reparenting.
The diagnostic logs child-count and class names (no personal data) and uses
only four bounded retries while Tauri is attaching its WebView.

**Safety:** exact debug package + FLAG_DEBUGGABLE + explicit ADB Intent boolean;
ordinary launches do not attach the probe. Neither SDK, consent bridge nor
advertisement requests are introduced or enabled. Tauri/WebView insets,
keyboard/rotation and actual placement must still be checked on Huawei.
Do not merge this Draft PR or deploy anything to production.


## Tablet right-panel debug placement candidate (2026-11-05)

User confirmed V7 `HOST_PROBE=ATTACHED_NO_ADS` on Huawei CMR-W09,
but the native blue strip intersected Android 3-button navigation controls.
**Native integration placement is therefore NOT approved**, even though the
view was attached successfully.

New **tablet-only visual experiment**: a hidden 320x50px HTML mock at the
bottom of the existing `resultBox` card, after generated results and saved
history. The layout is normal document flow, not positioned over content.
For a tablet (`smallestScreenWidthDp >= 600`) the exact isolated Android
debug package + debuggable flag + explicit ADB boolean extra triggers
`WebView.evaluateJavascript` to reveal it after Tauri loads. Default stays
hidden. No real ad SDK, consent collection or external requests. The native
50dp strip is NOT attached in this tablet path, so it cannot intersect
Android navigation. On smaller devices, existing native bottom host is
unchanged and its navigation-insets behavior is **not yet approved**.

The HTML placement is a mock only: a LevelPlay native Android banner cannot
be inserted directly into the HTML panel. Before any live SDK integration,
design and separately device-test a native positioning bridge or choose a
different safe native layout. Validate tablet generated results, history,
keyboard, portrait/landscape, system navigation, and background/restore.


### Huawei V8.1 landscape first-viewport finding (2026-11-05)

Owner-provided photos confirmed V8 HTML no-ad banner is correctly inside the right
result card on both orientations, does not overlap Android system navigation.
In landscape, it initially appeared below the first viewport (scroll required)
because `.resultBox` stretched to match the taller form and the banner
had `margin: auto auto 0`. In portrait, it was visible immediately.
V8.1 keeps portrait unchanged, and **only in landscape 851px+** uses the
debug-only `tablet-preview-active` class on the card to move the empty-state
result and banner upward in normal flow. A 1100x620 browser smoke checks
visibility without scrolling and verifies that generated results/history remain
above the mock. No ads or native positioning bridge introduced.


## Responsive debug tablet mock V8.2 (2026-11-06)

Huawei CMR-W09 CSS runtime diagnostics at 1024x640 in landscape measured
`BANNER_MARGIN_TOP=91.3313px` and `BANNER_DOCUMENT_Y=654px` despite
`LANDSCAPE_CSS_ACTIVE=true` and `TABLET_PREVIEW_CLASS_ACTIVE=true`.
The page had saved-history content, and WebView was not controlled by a service
worker. This proves that a passing browser smoke alone did not establish the
actual WebView's CSS margin values.

V8.2 uses responsive portrait/landscape styling for **all Android tablets**
(`smallestScreenWidthDp >= 600`) in normal content flow, rather than
hardcoding Huawei viewport dimensions. In landscape, the result placeholder
and the 320x50px test mock receive small `clamp()` margins. In portrait,
the existing bottom-of-card layout is preserved. This allows scrolling
instead of overlap if generated results and saved history exceed available
screen height. A small CSS fallback is injected at runtime **only** after
the exact debuggable pilot package and explicit ADB extra gates, so a stale
bundled stylesheet cannot silently restore large auto margins.

CI checks 8 viewport combinations: 1024x640, 1280x800, 960x600,
1100x620, 800x600, 768x1024, 800x1280 and 600x960, including placement
after result/history without overlays. Native ads are still NOT embedded
in the HTML panel; real LevelPlay SDK and ad requests remain OFF.
**Production and release are NO_GO.** Physical verification after V8.2
is a separate gate.


## Stage N1: Native view overlay alignment (pilot-only, NO ADS; 2026-11-06)

After V8.2, Huawei CMR-W09 Android 9 supplied a **VISUAL PASS** photo
for the responsive 320x50 HTML test slot inside the right result panel, above
Android navigation, below saved results.

The N1 prototype demonstrates how a **native Android View** could follow
that existing HTML-reserved rectangle without injecting an ad SDK. It does
not put a native View *into* the WebView. Instead, the exact isolated,
debuggable \`.levelplaypilot\` app plus TWO distinct explicit ADB extras
are required:

- \`org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE=true\`
- \`org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW=true\`

The default V8.2 no-ad HTML mock remains unchanged with only the first extra.
When both are set on a tablet (smallest width >=600dp), native
\`NativeAnchoredBannerProbe\` checks the DOM \`getBoundingClientRect()\`,
compares WebView pixel dimensions with CSS viewport dimensions, computes
screen-to-FrameLayout offsets and projects a non-interactive native TextView
into the reserved slot. A conservative visible display frame check prevents
the view from crossing Android navigation/status bars or the keyboard.
It hides rather than repositioning when the anchor is scrolled offscreen,
malformed, invalid or obscured. Polling is limited to the debug path at
450ms, and onPause/onDestroy release callbacks/view. No WebView child
reparenting, no JS interface, no persistence, no credentials or ad requests.

N1 is a **layout architecture experiment only**, not consent, network
ads, LevelPlay SDK initialization or production readiness. Automated
Kotlin compile-only and static safety checks are required; real Huawei
device viewport, scroll, keyboard, both orientations, rotation/restoration,
and failure/fallback evidence must be gathered before considering further work.
Production NO_GO, PR remains Draft, no merge or real SDK activation.


## N3 SDK placement handoff — compile-only; SDK and real ads OFF (2026-11-06)

Huawei CMR-W09 N1 + N2-T verified native TextView alignment in both
orientations and hiding when the slot exits the visible screen or the
SwiftKey IME covers it. N3 does **not** request advertising.

The main (SDK-free) module now declares `NativeBannerAnchorBounds`
(physical **root-local pixels**) and `NativeBannerAnchorListener`
(visible / hidden / released). `NativeAnchoredBannerProbe` emits those
events after its existing WebView coordinate, safe-area, system bar and
keyboard checks. **N3_SDK_PLACEMENT_HANDOFF_APPROVED = false**:
no listener registration is currently possible, and default N1 TextView
behavior is unchanged.

The optional `src/levelplayPilot` source set contains
`LevelPlayNativeBannerPlacementDraft`, compiled against real Android
Unity LevelPlay SDK 9.5.0, with
**N3_REAL_BANNER_MOUNT_APPROVED = false**. This adapter would be able to
accept an already created/initialized `LevelPlayBannerAdView` and map
the approved geometry to a native FrameLayout child; it **never** creates
a banner, calls `LevelPlay.init`, requests an ad or claims to implement
a CMP. It is not constructed or referenced by MainActivity.

The SDK reports `LevelPlayAdSize.BANNER` as 320×50 dp. A smaller HTML
anchor cannot safely host a standard banner; the draft **hides** instead
of scaling, clipping or overlapping app controls. The Huawei portrait
right panel (~298 CSS px) therefore needs future adaptive-size negotiation
or layout redesign before a real banner could be shown there. Official
SDK documentation also requires SDK initialization before banner creation.
Do not assume HTML placeholder compatibility equals real banner readiness.

N3 CI compile-only test copies 6 Kotlin source files into an isolated
Android library module: SDK-free host, tablet probe, anchor, shared geometry
contract, dormant SDK integration draft and N3 adapter. No APK or AAB is
built by CI. PR remains Draft, no production writes, no SDK/ad init,
no identifiers/keys, `REAL_ADS=OFF`, `PRODUCTION_NO_GO=TRUE`.
