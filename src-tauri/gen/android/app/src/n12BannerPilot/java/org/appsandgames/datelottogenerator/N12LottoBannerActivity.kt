package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.os.Bundle
import android.preference.PreferenceManager
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import com.unity3d.mediation.LevelPlay
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.LevelPlayConfiguration
import com.unity3d.mediation.LevelPlayInitError
import com.unity3d.mediation.LevelPlayInitListener
import com.unity3d.mediation.LevelPlayInitRequest
import com.unity3d.mediation.banner.LevelPlayBannerAdView
import com.unity3d.mediation.banner.LevelPlayBannerAdViewListener

/**
 * N12 — genuinely testable banner inside the normal Tauri Date Lotto UI.
 *
 * This Activity exists ONLY in an opt-in, isolated debuggable pilot classpath
 * with its own Android manifest. No default/release/production source imports
 * or references this class. The SDK and UMP are NEVER started by MainActivity.
 *
 * UMP is refreshed before any SDK start. Purpose-consent bits are inspected
 * (not logged), and SDK start requires an additional owner-enabled build gate
 * AND an explicit UI tap. No automated SDK start or ad request.
 *
 * The N5 view geometry was already physically validated on Huawei; all
 * positioning and clipping are delegated to the original native probe.
 */
internal class N12LottoBannerActivity : TauriActivity(), NativeBannerAnchorListener {
    companion object {
        private const val TAG = "DateLottoN12"
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val EXTRA_OWNER_START =
            "org.appsandgames.datelottogenerator.DEBUG_N12_TEST_BANNER"
    }

    private var probe: NativeBannerHostProbe? = null
    private var nativeRoot: FrameLayout? = null
    private var banner: LevelPlayBannerAdView? = null
    private var slot: N4BannerPixelPlacement? = null
    private var consentRefreshed = false
    private var consentFormComplete = false
    private var sdkInitialized = false
    private var oneTestAttempted = false
    // One approved banner request must remain ONE even after Activity/process
    // restart or after Unity test-mode expires. Store only a boolean in the
    // isolated .levelplaypilot app; no IDs or consent strings here.
    private fun alreadyUsedOneApprovedTest(): Boolean =
        getSharedPreferences("n12_one_approved_banner_test", MODE_PRIVATE)
            .getBoolean("one_request_used", false)

    private fun consumeOneApprovedTest(): Boolean {
        if (oneTestAttempted || alreadyUsedOneApprovedTest()) return false
        val saved = getSharedPreferences("n12_one_approved_banner_test", MODE_PRIVATE)
            .edit().putBoolean("one_request_used", true).commit()
        if (saved) oneTestAttempted = true
        return saved
    }
    private var sdkInitializing = false
    private var permissionWithdrawn = false
    private var finalized = false
    private var refreshing = false
    private lateinit var testButton: Button
    private lateinit var privacyButton: Button
    private lateinit var stateLabel: TextView
    private var testControls: LinearLayout? = null
    private var testControlsRoot: FrameLayout? = null

    /**
     * Keep N12 controls in Window DecorView, a sibling of the Android content
     * frame. Tauri may asynchronously REPLACE the content-frame children,
     * which removes an early-added panel; bringToFront() cannot fix a view
     * whose parent is no longer the frame. Debug overlay never touches the
     * N5 native banner positioning root or any production Activity.
     */
    private fun keepDebugControlsVisible() {
        val root = testControlsRoot ?: return
        val panel = testControls ?: return
        if (!ownerDebugOnly()) return
        if (panel.parent !== root) {
            (panel.parent as? android.view.ViewGroup)?.removeView(panel)
            val density = resources.displayMetrics.density
            fun dp(n: Int): Int = (n * density + .5f).toInt()
            root.addView(
                panel,
                FrameLayout.LayoutParams(
                    dp(190), FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.TOP or Gravity.END
                ).apply {
                    topMargin = dp(120)
                    rightMargin = dp(8)
                }
            )
            Log.i(TAG, "N12_TEST_CONTROLS_DECOR_REATTACHED")
        }
        if (root.getChildAt(root.childCount - 1) !== panel) {
            panel.bringToFront()
        }
        panel.visibility = View.VISIBLE
    }


    private val ump by lazy { UserMessagingPlatform.getConsentInformation(this) }

    private fun ownerDebugOnly(): Boolean =
        packageName == PILOT_PACKAGE &&
        (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 &&
        BuildConfig.DEBUG &&
        intent?.getBooleanExtra(EXTRA_OWNER_START, false) == true &&
        !finalized && !isFinishing && !isDestroyed

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!ownerDebugOnly()) {
            Log.w(TAG, "N12_BLOCKED_ISOLATED_DEBUG_ONLY")
            finish()
            return
        }
        // Reuse all THREE earlier N5 UI/anchor flags without asking the
        // owner to type three different ADB booleans again.
        intent.putExtra(
            "org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE", true
        )
        intent.putExtra(
            "org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW", true
        )
        intent.putExtra(
            "org.appsandgames.datelottogenerator.DEBUG_N5_PORTRAIT_RAIL", true
        )

        nativeRoot = findViewById(android.R.id.content)
        installSmallDebugControls()
        probe = NativeBannerHostProbe(this, this).also { it.scheduleIfRequested() }
        refreshUmpForThisLaunch()
        Log.i(TAG, "N12_STARTED_WITHOUT_ADS")
    }

    private fun installSmallDebugControls() {
        // An Activity content FrameLayout can be emptied by Tauri later.
        // The decor root is outside that replaceable content subtree.
        val root = window.decorView as? FrameLayout
        if (root == null) {
            Log.w(TAG, "N12_TEST_CONTROLS_DECOR_UNAVAILABLE")
            return
        }
        testControlsRoot = root
        val density = resources.displayMetrics.density
        fun dp(n: Int): Int = (n * density + .5f).toInt()
        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(4), dp(4), dp(4), dp(4))
            setBackgroundColor(Color.argb(230, 13, 28, 49))
            elevation = dp(5).toFloat()
        }
        stateLabel = TextView(this).apply {
            textSize = 11f
            setTextColor(Color.WHITE)
            text = "UMP provjera — oglasi OFF"
        }
        privacyButton = Button(this).apply {
            text = "Privola / opcije"
            textSize = 11f
            isEnabled = false
            setOnClickListener { showPrivacyOptionsFromTap() }
        }
        testButton = Button(this).apply {
            text = "Pokreni TEST banner"
            textSize = 11f
            isEnabled = false
            setOnClickListener { startSdkFromExplicitUserTap() }
        }
        controls.addView(stateLabel)
        controls.addView(privacyButton)
        controls.addView(testButton)
        testControls = controls
        controls.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        root.addView(
            controls,
            FrameLayout.LayoutParams(
                dp(190), FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.END
            ).apply {
                // Below the Tauri header/settings buttons; debug UI ONLY.
                topMargin = dp(120)
                rightMargin = dp(8)
            }
        )
        // Tauri's WebView is asynchronous; one immediate reorder is not enough.
        // No timers, SDK calls, or ad requests: just Android UI Z-order.
        root.post { keepDebugControlsVisible() }
        root.postDelayed({ keepDebugControlsVisible() }, 1000L)
        root.postDelayed({ keepDebugControlsVisible() }, 3000L)
        Log.i(TAG, "N12_TEST_CONTROLS_ADDED_TO_DECOR")
    }

    /**
     * UMP's canRequestAds() can also be true when the user rejects consent.
     * Fail closed for this TEST (not a general GDPR consent engine): require
     * all ten TCF purposes opted in, not merely UMP ready. This deliberately
     * blocks contextual / limited ads and any ambiguous UMP state.
     */
    private fun hasExplicitFullTcfOptIn(): Boolean {
        if (!ownerDebugOnly() || !consentRefreshed || !consentFormComplete ||
            permissionWithdrawn || !ump.canRequestAds() ||
            ump.consentStatus != ConsentInformation.ConsentStatus.OBTAINED) return false
        val purpose = PreferenceManager.getDefaultSharedPreferences(this)
            .getString("IABTCF_PurposeConsents", "") ?: ""
        // Do not persist, transmit or LOG these TCF bits.
        return purpose.length >= 10 && purpose.take(10).all { it == '1' }
    }

    private fun refreshUmpForThisLaunch() {
        if (!ownerDebugOnly() || refreshing) return
        refreshing = true
        consentRefreshed = false
        consentFormComplete = false
        disableAndDestroyBanner()
        status("Dohvat UMP privole…")
        ump.requestConsentInfoUpdate(
            this, ConsentRequestParameters.Builder().build(),
            {
                if (!ownerDebugOnly()) return@requestConsentInfoUpdate
                consentRefreshed = true
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { error ->
                    refreshing = false
                    if (!ownerDebugOnly()) return@loadAndShowConsentFormIfRequired
                    consentFormComplete = (error == null)
                    if (consentFormComplete) {
                        status(if (hasExplicitFullTcfOptIn())
                            "Privola potvrđena · test spreman"
                            else "Bez potpune privole · oglasi OFF")
                    } else status("UMP obrazac nije uspio · oglasi OFF")
                    refreshControls()
                }
            },
            {
                refreshing = false
                consentRefreshed = false
                consentFormComplete = false
                if (ownerDebugOnly()) {
                    status("UMP mrežna pogreška · oglasi OFF")
                    refreshControls()
                }
            }
        )
    }

    private fun showPrivacyOptionsFromTap() {
        if (!ownerDebugOnly() || refreshing ||
            ump.privacyOptionsRequirementStatus !=
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) return

        // Any revised preference is treated as withdrawal for this process.
        // A fresh process/UMP roundtrip is needed before a new test.
        permissionWithdrawn = true
        disableAndDestroyBanner()
        status("Izmjena privole · oglasi OFF")
        UserMessagingPlatform.showPrivacyOptionsForm(this) { error ->
            if (ownerDebugOnly()) {
                status(if (error == null) "Opcije spremljene · ponovo pokreni test"
                    else "UMP opcije pogreška · oglasi OFF")
                refreshControls()
            }
        }
    }

    private fun refreshControls() {
        if (!ownerDebugOnly()) return
        privacyButton.isEnabled = !refreshing &&
            ump.privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        testButton.isEnabled =
            BuildConfig.N12_OWNER_TEST_AD_REQUESTS_APPROVED &&
            BuildConfig.N12_APP_KEY.isNotBlank() &&
            BuildConfig.N12_BANNER_UNIT_ID.isNotBlank() &&
            !sdkInitializing && !sdkInitialized && !oneTestAttempted &&
            !alreadyUsedOneApprovedTest() &&
            hasExplicitFullTcfOptIn()
    }

    private fun status(text: String) {
        if (::stateLabel.isInitialized) stateLabel.text = text
        // Never log TCF consent bits, CMP strings, developer keys, AD IDs.
        Log.i(TAG, "N12_STATUS_CHANGED_NO_IDENTIFIERS")
    }

    private fun startSdkFromExplicitUserTap() {
        if (!ownerDebugOnly() ||
            !BuildConfig.N12_OWNER_TEST_AD_REQUESTS_APPROVED ||
            !hasExplicitFullTcfOptIn() ||
            sdkInitialized || sdkInitializing || oneTestAttempted ||
            alreadyUsedOneApprovedTest() ||
            BuildConfig.N12_APP_KEY.isBlank() || BuildConfig.N12_BANNER_UNIT_ID.isBlank()) return
        sdkInitializing = true
        refreshControls()
        status("LevelPlay test inicijalizacija…")
        LevelPlay.init(
            this, LevelPlayInitRequest.Builder(BuildConfig.N12_APP_KEY).build(),
            object : LevelPlayInitListener {
                override fun onInitFailed(error: LevelPlayInitError) {
                    runOnUiThread {
                        sdkInitializing = false
                        if (ownerDebugOnly()) status("LevelPlay init neuspješan")
                    }
                }
                override fun onInitSuccess(configuration: LevelPlayConfiguration) {
                    runOnUiThread {
                        sdkInitializing = false
                        if (!ownerDebugOnly() || !hasExplicitFullTcfOptIn()) {
                            disableAndDestroyBanner()
                            return@runOnUiThread
                        }
                        sdkInitialized = true
                        status("SDK spreman · čekam N5 položaj")
                        mountBannerOnlyInValidatedN5Slot()
                    }
                }
            }
        )
    }

    private fun mountBannerOnlyInValidatedN5Slot() {
        val root = nativeRoot ?: return
        val fit = slot ?: return
        if (!sdkInitialized || !hasExplicitFullTcfOptIn() || !ownerDebugOnly() ||
            !BuildConfig.N12_OWNER_TEST_AD_REQUESTS_APPROVED) return
        if (banner != null) {
            moveBannerTo(fit)
            return
        }
        val config = LevelPlayBannerAdView.Config.Builder()
            .setAdSize(LevelPlayAdSize.BANNER)
            .build()
        val ad = LevelPlayBannerAdView(this, BuildConfig.N12_BANNER_UNIT_ID, config)
        ad.bannerListener = object : LevelPlayBannerAdViewListener {
            override fun onAdLoaded(adInfo: LevelPlayAdInfo) {
                // Approved scope is ONE test-load, not repeating refreshes.
                banner?.pauseAutoRefresh()
                if (ownerDebugOnly()) status("TEST banner učitan · refresh OFF")
            }
            override fun onAdLoadFailed(error: LevelPlayAdError) {
                banner?.pauseAutoRefresh()
                // Only the numeric SDK error code is allowed into diagnostic
                // UI/logs. Error messages can contain publisher/device IDs,
                // bid data, network URLs or private consent details.
                val code = error.errorCode
                Log.w(TAG, "N12_BANNER_LOAD_FAILED_CODE=$code")
                if (ownerDebugOnly()) status("TEST banner nije učitan · kod $code · nema ponavljanja")
            }
            override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {}
            override fun onAdDisplayFailed(adInfo: LevelPlayAdInfo, error: LevelPlayAdError) {
                val code = error.errorCode
                Log.w(TAG, "N12_BANNER_DISPLAY_FAILED_CODE=$code")
                if (ownerDebugOnly()) status("TEST banner nije prikazan · kod $code")
            }
            override fun onAdClicked(adInfo: LevelPlayAdInfo) {}
            override fun onAdExpanded(adInfo: LevelPlayAdInfo) {}
            override fun onAdCollapsed(adInfo: LevelPlayAdInfo) {}
            override fun onAdLeftApplication(adInfo: LevelPlayAdInfo) {}
        }
        banner = ad
        root.addView(ad, FrameLayout.LayoutParams(fit.widthPx, fit.heightPx,
            Gravity.TOP or Gravity.START).apply {
            leftMargin = fit.leftPx
            topMargin = fit.topPx
        })
        // This is the *only* call that requests an ad. It is unreachable unless
        // the separate build gate was enabled and the user pressed TEST.
        if (ownerDebugOnly() && hasExplicitFullTcfOptIn() &&
            BuildConfig.N12_OWNER_TEST_AD_REQUESTS_APPROVED &&
            consumeOneApprovedTest()) {
            ad.loadAd()
        } else disableAndDestroyBanner()
    }

    private fun moveBannerTo(fit: N4BannerPixelPlacement) {
        val ad = banner ?: return
        val old = ad.layoutParams as? FrameLayout.LayoutParams
        if (old == null || old.width != fit.widthPx ||
            old.height != fit.heightPx || old.leftMargin != fit.leftPx ||
            old.topMargin != fit.topPx
        ) {
            ad.layoutParams = FrameLayout.LayoutParams(
                fit.widthPx, fit.heightPx, Gravity.TOP or Gravity.START
            ).apply {
                leftMargin = fit.leftPx
                topMargin = fit.topPx
            }
        }
        // N5 polls the anchor roughly every 450 ms. Repeatedly resuming the
        // SDK refresh timer on every poll would be incorrect.
        if (ad.visibility != View.VISIBLE) {
            ad.visibility = View.VISIBLE
            ad.resumeAutoRefresh()
        }
    }

    override fun onAnchorVisible(bounds: NativeBannerAnchorBounds) {
        if (!ownerDebugOnly()) return
        keepDebugControlsVisible()
        val root = nativeRoot ?: return
        val candidate = N4BannerSizeFitPolicy.fit(
            bounds, 320, 50, resources.displayMetrics.density,
            root.width, root.height
        )
        slot = candidate
        if (candidate == null) {
            banner?.pauseAutoRefresh()
            banner?.visibility = View.GONE
        } else if (sdkInitialized && hasExplicitFullTcfOptIn()) {
            mountBannerOnlyInValidatedN5Slot()
        }
    }
    override fun onAnchorHidden() {
        keepDebugControlsVisible()
        slot = null
        banner?.pauseAutoRefresh()
        banner?.visibility = View.GONE
    }
    override fun onAnchorReleased() {
        slot = null
        banner?.pauseAutoRefresh()
        banner?.visibility = View.GONE
    }

    private fun disableAndDestroyBanner() {
        banner?.pauseAutoRefresh()
        banner?.destroy()
        (banner?.parent as? FrameLayout)?.removeView(banner)
        banner = null
        slot = null
        if (::testButton.isInitialized) testButton.isEnabled = false
    }

    override fun onResume() {
        super.onResume()
        probe?.resume()
        nativeRoot?.post { keepDebugControlsVisible() }
        if (!finalized && consentRefreshed && !hasExplicitFullTcfOptIn()) {
            disableAndDestroyBanner()
        }
    }
    override fun onPause() {
        banner?.pauseAutoRefresh()
        probe?.pause()
        super.onPause()
    }
    override fun onDestroy() {
        finalized = true
        (testControls?.parent as? android.view.ViewGroup)?.removeView(testControls)
        testControlsRoot = null
        testControls = null
        disableAndDestroyBanner()
        probe?.detach()
        probe = null
        nativeRoot = null
        super.onDestroy()
    }
}
