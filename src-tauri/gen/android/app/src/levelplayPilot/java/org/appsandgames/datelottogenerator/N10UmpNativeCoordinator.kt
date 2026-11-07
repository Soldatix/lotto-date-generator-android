package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Looper
import android.widget.FrameLayout
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * N10: compile-only integration of real UMP callback sequence and the N5
 * native anchor contract. The class itself has no banner SDK imports/requests.
 *
 * OPTIONAL SDK+UMP debug classpath only; NOT called by MainActivity.
 * Runtime guard is permanently false pending a separate developer/privacy
 * review, in part because including SDK/AdQuality can have startup effects.
 */
internal class N10UmpNativeCoordinator(
    private val activity: Activity,
    private val root: FrameLayout,
    private val onDiagnosticState: (N10Snapshot) -> Unit = {}
) : NativeBannerAnchorListener {
    companion object {
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val N10_UMP_RUNTIME_APPROVED = false
        private const val N10_N5_SDK_HANDOFF_APPROVED = false
    }

    private val session = N10FailClosedSession()
    private val ump by lazy { UserMessagingPlatform.getConsentInformation(activity) }
    private var destroyed = false

    private fun ownerDebugOnly(): Boolean =
        activity.packageName == PILOT_PACKAGE &&
        (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 &&
        !activity.isFinishing && !activity.isDestroyed && !destroyed

    private fun onMain(): Boolean = Looper.myLooper() == Looper.getMainLooper()

    private fun publish() {
        onDiagnosticState(session.snapshot())
        // A diagnostic snapshot is NOT an ad authorization: both SDK flags
        // in N10FailClosedSession are hard-coded to false.
    }

    /**
     * Exactly Google UMP's per-launch refresh -> form sequence.
     * The method is deliberately unreachable while the combined APK is
     * unapproved. No cached TCF string is examined.
     */
    fun startConsentCheckAfterSeparateReview(): Boolean {
        if (!N10_UMP_RUNTIME_APPROVED || !ownerDebugOnly() || !onMain()) return false
        val generation = session.beginRefresh() ?: return false
        publish()
        ump.requestConsentInfoUpdate(
            activity,
            ConsentRequestParameters.Builder().build(),
            {
                if (!ownerDebugOnly() ||
                    !session.refreshed(
                        generation,
                        ump.canRequestAds(), // diagnostic only; NOT acceptance.
                        ump.privacyOptionsRequirementStatus ==
                            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                    )
                ) return@requestConsentInfoUpdate
                publish()
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { error ->
                    if (!ownerDebugOnly()) {
                        session.failClosed()
                    } else {
                        session.completedConsentForm(generation, error == null)
                    }
                    publish()
                }
            },
            {
                // Consent network errors never unlock an SDK/advertising path.
                session.failClosed()
                publish()
            }
        )
        return true
    }

    /**
     * Must only be called from a real user click. Successful form dismissal
     * is treated as a possible withdrawal until exact vendor/purpose evidence
     * is reviewed; does not automatically reinstate previous permission.
     */
    fun showPrivacyOptionsFromUserTap(): Boolean {
        if (!N10_UMP_RUNTIME_APPROVED || !ownerDebugOnly() || !onMain()) return false
        val generation = session.beginPrivacyOptionsFromUserAction() ?: return false
        publish()
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { error ->
            if (!ownerDebugOnly()) {
                session.failClosed()
            } else {
                session.privacyOptionsClosed(generation, error == null)
            }
            publish()
        }
        return true
    }

    /** Future listener registration requires another distinct runtime gate. */
    fun listenerForFutureN5Handoff(): NativeBannerAnchorListener? {
        if (!N10_N5_SDK_HANDOFF_APPROVED || !ownerDebugOnly() || !onMain()) return null
        return this
    }

    override fun onAnchorVisible(bounds: NativeBannerAnchorBounds) {
        if (!ownerDebugOnly() || !onMain()) {
            session.anchorHidden()
            publish()
            return
        }
        session.updateN5Anchor(
            bounds,
            activity.resources.displayMetrics.density,
            root.width,
            root.height
        )
        publish()
        // Deliberately do not instantiate or mount a LevelPlayBannerAdView.
    }

    override fun onAnchorHidden() {
        session.anchorHidden()
        publish()
    }

    override fun onAnchorReleased() {
        // A slot disappearing is NOT a new privacy decision.
        session.anchorHidden()
        publish()
    }

    fun onConsentRevoked() {
        session.withdrawn()
        publish()
        // Any future native SDK owner must destroy a mounted banner too.
        // This review-only coordinator never holds a LevelPlay view.
    }

    fun onPause() {
        session.pause()
        publish()
    }

    fun onResume() {
        session.resume()
        publish()
        // No automatic cached-consent reuse, SDK init or ad refresh.
    }

    fun onDestroy() {
        destroyed = true
        session.close()
        publish()
    }
}
