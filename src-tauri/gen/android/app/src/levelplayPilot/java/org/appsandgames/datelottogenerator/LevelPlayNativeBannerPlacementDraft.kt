package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import com.unity3d.mediation.LevelPlayAdSize
import com.unity3d.mediation.banner.LevelPlayBannerAdView
import kotlin.math.roundToInt

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
    }

    private var bannerView: LevelPlayBannerAdView? = null
    private var mounted = false

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

        // LevelPlay BANNER must not be scaled/clipped into a smaller slot.
        // Huawei portrait uses ~298dp in the right column: fail closed.
        // Future adaptive-size support needs its own safe size negotiation.
        val density = activity.resources.displayMetrics.density
        val standardWidthPx = (LevelPlayAdSize.BANNER.width * density).roundToInt()
        val standardHeightPx = (LevelPlayAdSize.BANNER.height * density).roundToInt()
        if (bounds.widthPx < standardWidthPx ||
            bounds.heightPx < standardHeightPx ||
            bounds.leftPx < 0 || bounds.topPx < 0 ||
            bounds.leftPx + standardWidthPx > root.width ||
            bounds.topPx + standardHeightPx > root.height) {
            view.visibility = View.GONE
            return
        }
        val layout = FrameLayout.LayoutParams(
            standardWidthPx, standardHeightPx, Gravity.TOP or Gravity.START
        )
        layout.leftMargin = bounds.leftPx + (bounds.widthPx - standardWidthPx) / 2
        layout.topMargin = bounds.topPx + (bounds.heightPx - standardHeightPx) / 2
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
