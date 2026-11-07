package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.banner.LevelPlayBannerAdView

/**
 * N3 architecture compile-only bridge: NativeBannerAnchorBounds -> LevelPlay View.
 *
 * WARNING: This Kotlin file exists exclusively in the opt-in LevelPlay source
 * set, separate from ordinary Android production/debug binaries.
 *
 * Even a developer-enabled source set CANNOT mount a real SDK view:
 * N3_REAL_BANNER_MOUNT_APPROVED is a permanent false hard stop here.
 * Never pass actual ad-unit IDs, initialize SDK, or invoke loadAd in this class.
 * Future work requires separate consent/legal review and explicit code review.
 */
internal class LevelPlayNativeBannerPlacementDraft(
    private val activity: Activity,
    private val root: FrameLayout
) : NativeBannerAnchorListener {
    companion object {
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val N3_REAL_BANNER_MOUNT_APPROVED = false
        private const val N4_ADAPTIVE_SIZE_NEGOTIATION_APPROVED = false
    }

    private var bannerView: LevelPlayBannerAdView? = null
    private var mounted = false
    private var selectedSize: LevelPlayAdSize = LevelPlayAdSize.BANNER

    /**
     * This only type-checks the official Android adaptive size API;
     * it cannot run in the N4 pilot. Adaptive is DEVICE width based, not
     * necessarily the narrow width of our right-hand result panel.
     */
    fun proposeAdaptiveCandidateAfterReview(): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!N4_ADAPTIVE_SIZE_NEGOTIATION_APPROVED) return false
        if (activity.packageName != PILOT_PACKAGE ||
            (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0) return false
        val candidate = LevelPlayAdSize.createAdaptiveAdSize(activity) ?: return false
        selectedSize = candidate
        return true
    }

    fun previewCandidateFitNoAds(bounds: NativeBannerAnchorBounds): N4BannerPixelPlacement? =
        N4BannerSizeFitPolicy.fit(
            bounds, selectedSize.width, selectedSize.height,
            activity.resources.displayMetrics.density,
            root.width, root.height
        )

    /**
     * Only a fully initialized, pre-created SDK view could be passed here
     * after an entirely separate authorization step. N3 never creates one.
     * Consent is a future precondition, not a consent mechanism or proof.
     */
    fun mountExistingViewAfterReview(
        sdkView: LevelPlayBannerAdView,
        sdkInitialized: Boolean,
        verifiedConsent: Boolean
    ): Boolean {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!N3_REAL_BANNER_MOUNT_APPROVED) return false
        if (!N4ConsentGateDraft.sdkInitializationPermitted(N4CmpEvidence())) return false
        if (activity.packageName != PILOT_PACKAGE ||
            (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0 ||
            !sdkInitialized || !verifiedConsent ||
            mounted || sdkView.parent != null) return false

        bannerView = sdkView
        sdkView.visibility = View.GONE
        root.addView(sdkView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP or Gravity.START
        ))
        mounted = true
        return true
    }

    override fun onAnchorVisible(bounds: NativeBannerAnchorBounds) {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!N3_REAL_BANNER_MOUNT_APPROVED || !mounted) return
        val view = bannerView ?: return

        // Do not resize/crop a real SDK creative: check the full candidate
        // size against the N1-verified native rectangle, otherwise hide.
        val placement = previewCandidateFitNoAds(bounds)
        if (placement == null) {
            view.visibility = View.GONE
            return
        }
        val layout = FrameLayout.LayoutParams(
            placement.widthPx, placement.heightPx, Gravity.TOP or Gravity.START
        )
        layout.leftMargin = placement.leftPx
        layout.topMargin = placement.topPx
        view.layoutParams = layout
        view.visibility = View.VISIBLE
    }

    override fun onAnchorHidden() {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!N3_REAL_BANNER_MOUNT_APPROVED) return
        bannerView?.visibility = View.GONE
    }

    override fun onAnchorReleased() {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (!N3_REAL_BANNER_MOUNT_APPROVED) return
        val view = bannerView
        if (view != null) {
            view.visibility = View.GONE
            if (view.parent === root) root.removeView(view)
            // Only the SDK owner may call LevelPlayBannerAdView.destroy().
            // Never confuse removing an Android view with SDK teardown.
        }
        bannerView = null
        mounted = false
    }
}
