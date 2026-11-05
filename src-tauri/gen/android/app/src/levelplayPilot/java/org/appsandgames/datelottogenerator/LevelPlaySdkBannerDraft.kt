package org.appsandgames.datelottogenerator

import android.app.Activity
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.unity3d.mediation.LevelPlay
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.LevelPlayConfiguration
import com.unity3d.mediation.LevelPlayInitError
import com.unity3d.mediation.LevelPlayInitListener
import com.unity3d.mediation.LevelPlayInitRequest
import com.unity3d.mediation.LevelPlayPrivacySettings
import com.unity3d.mediation.banner.LevelPlayBannerAdView
import com.unity3d.mediation.banner.LevelPlayBannerAdViewListener

/**
 * Android-only, optional SDK compilation test.
 * THIS CLASS IS NOT INCLUDED in normal builds and is NEVER called by MainActivity.
 * It can only enter the opt-in source set by passing
 * -PappsGamesLevelPlaySdkPilot=true for a disposable debug build.
 *
 * PRODUCTION NO-GO: Explicit second hard-stop below prevents even that debug
 * build from initializing or contacting LevelPlay until consent, Tauri view
 * hierarchy, test-device setup, data safety, and review are finished.
 */
internal class LevelPlaySdkBannerDraft(
    private val activity: Activity,
    private val host: FrameLayout
) {
    companion object {
        private const val TAG = "LevelPlayPilot"
        private const val APPROVED_AD_REQUESTS = false // NEVER automatically enable
    }

    private var initialized = false
    private var banner: LevelPlayBannerAdView? = null

    /**
     * This is NOT wired to the HTML demo 'Allow' button.
     * Only a future verified *native* consent-management implementation
     * may call this, after explicit deployment review.
     */
    fun startAfterVerifiedConsent(
        appKey: String,
        adUnitId: String,
        consentGranted: Boolean
    ) {
        if (!APPROVED_AD_REQUESTS || !consentGranted ||
            appKey.isBlank() || adUnitId.isBlank() || initialized) return

        activity.runOnUiThread {
            if (initialized) return@runOnUiThread
            initialized = true
            // This flag is a platform-level signal, NOT proof of lawful CMP consent.
            LevelPlayPrivacySettings.setGDPRConsent(true)
            val request = LevelPlayInitRequest.Builder(appKey).build()
            LevelPlay.init(activity, request, object : LevelPlayInitListener {
                override fun onInitFailed(error: LevelPlayInitError) {
                    initialized = false
                    Log.w(TAG, "SDK initialization failed")
                }

                override fun onInitSuccess(configuration: LevelPlayConfiguration) {
                    if (!APPROVED_AD_REQUESTS) return
                    createBanner(adUnitId)
                }
            })
        }
    }

    private fun createBanner(adUnitId: String) {
        if (!APPROVED_AD_REQUESTS || banner != null) return
        val config = LevelPlayBannerAdView.Config.Builder()
            .setAdSize(LevelPlayAdSize.BANNER) // 320 x 50 dp
            .build()
        val view = LevelPlayBannerAdView(activity, adUnitId, config)
        view.bannerListener = object : LevelPlayBannerAdViewListener {
            override fun onAdLoaded(adInfo: LevelPlayAdInfo) {
                Log.d(TAG, "Banner loaded in isolated test")
            }
            override fun onAdLoadFailed(error: LevelPlayAdError) {
                Log.w(TAG, "Banner load failed in isolated test")
            }
            override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {}
            override fun onAdDisplayFailed(adInfo: LevelPlayAdInfo, error: LevelPlayAdError) {}
            override fun onAdClicked(adInfo: LevelPlayAdInfo) {}
            override fun onAdExpanded(adInfo: LevelPlayAdInfo) {}
            override fun onAdCollapsed(adInfo: LevelPlayAdInfo) {}
            override fun onAdLeftApplication(adInfo: LevelPlayAdInfo) {}
        }
        banner = view
        host.removeAllViews()
        host.addView(view, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ))
        host.visibility = View.VISIBLE
        view.loadAd()
    }

    fun pause() {
        activity.runOnUiThread { banner?.pauseAutoRefresh() }
    }

    fun resume() {
        activity.runOnUiThread {
            if (APPROVED_AD_REQUESTS) banner?.resumeAutoRefresh()
        }
    }

    fun destroyAndWithdraw() {
        activity.runOnUiThread {
            banner?.destroy()
            banner = null
            host.removeAllViews()
            host.visibility = View.GONE
            // Withdrawal prevents future requests; it cannot delete previously
            // issued third-party identifiers/cookies by itself.
        }
    }
}
