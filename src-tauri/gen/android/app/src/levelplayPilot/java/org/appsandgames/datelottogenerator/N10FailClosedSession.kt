package org.appsandgames.datelottogenerator

/**
 * Pure N10 runtime state machine: UMP progress + N5 placement, with ZERO
 * authorization to initialize LevelPlay or load an ad.
 *
 * No Android I/O, identifiers, SDK calls, storage, or consent-string parsing.
 * Only explicit fresh UMP callbacks may advance the diagnostic state.
 */
internal enum class N10Phase {
    UNCHECKED, REFRESHING, FORM_PENDING, REVIEW_ONLY, FAILED, WITHDRAWN, CLOSED
}

internal data class N10Snapshot(
    val phase: N10Phase,
    val refreshSucceededThisLaunch: Boolean,
    val umpCanRequestAdsReported: Boolean,
    val privacyOptionsRequired: Boolean,
    val n5Fit: N4BannerPixelPlacement?,
    val sdkInitializationAllowed: Boolean = false,
    val testAdRequestAllowed: Boolean = false
)

internal class N10FailClosedSession {
    companion object {
        // Separate explicit publisher approval is required to change ANY
        // request gate in a future reviewed implementation.
        private const val N10_SDK_INIT_APPROVED = false
        private const val N10_TEST_AD_REQUESTS_APPROVED = false
    }

    private var phase = N10Phase.UNCHECKED
    private var generation = 0L
    private var refreshed = false
    private var reportedCanRequestAds = false
    private var optionsRequired = false
    private var fit: N4BannerPixelPlacement? = null
    private var paused = false

    fun snapshot(): N10Snapshot = N10Snapshot(
        phase = phase,
        refreshSucceededThisLaunch = refreshed,
        umpCanRequestAdsReported = reportedCanRequestAds,
        privacyOptionsRequired = optionsRequired,
        n5Fit = fit,
        sdkInitializationAllowed = N10_SDK_INIT_APPROVED && false,
        testAdRequestAllowed = N10_TEST_AD_REQUESTS_APPROVED && false
    )

    /** Generation guards drop late, re-entrant, and post-revocation callbacks. */
    fun beginRefresh(): Long? {
        if (phase == N10Phase.CLOSED || phase == N10Phase.REFRESHING ||
            phase == N10Phase.FORM_PENDING) return null
        generation++
        phase = N10Phase.REFRESHING
        refreshed = false
        reportedCanRequestAds = false
        optionsRequired = false
        fit = null
        return generation
    }

    fun refreshed(g: Long, umpReady: Boolean, privacyRequired: Boolean): Boolean {
        if (g != generation || phase != N10Phase.REFRESHING) return false
        refreshed = true
        reportedCanRequestAds = umpReady // diagnostic only, not user opt-in.
        optionsRequired = privacyRequired
        phase = N10Phase.FORM_PENDING
        return true
    }

    fun completedConsentForm(g: Long, success: Boolean): Boolean {
        if (g != generation || phase != N10Phase.FORM_PENDING) return false
        if (success) {
            phase = N10Phase.REVIEW_ONLY
        } else {
            failClosed()
        }
        return true
    }

    /** Privacy-options form must be opened only after a real user tap. */
    fun beginPrivacyOptionsFromUserAction(): Long? {
        if (phase != N10Phase.REVIEW_ONLY || !optionsRequired) return null
        generation++
        phase = N10Phase.FORM_PENDING
        // Immediately hide old placement: the choice may change to refusal.
        fit = null
        return generation
    }

    /** Fail closed even when the privacy form returns without an SDK error. */
    fun privacyOptionsClosed(g: Long, success: Boolean): Boolean {
        if (g != generation || phase != N10Phase.FORM_PENDING) return false
        if (success) {
            // NEVER infer acceptance from successful dismissal. Explicit
            // vendor-and-purpose evidence is separately required in the future.
            withdrawn()
        } else {
            failClosed()
        }
        return true
    }

    /** Existing N5/N4 geometry, no creative and no network access. */
    fun updateN5Anchor(
        anchor: NativeBannerAnchorBounds,
        density: Float,
        rootWidthPx: Int,
        rootHeightPx: Int
    ): N4BannerPixelPlacement? {
        fit = if (phase == N10Phase.REVIEW_ONLY && !paused && refreshed) {
            N4BannerSizeFitPolicy.fit(
                anchor, 320, 50, density, rootWidthPx, rootHeightPx
            )
        } else null
        return fit
    }

    fun anchorHidden() { fit = null }
    fun pause() { paused = true; fit = null }
    fun resume() { if (phase != N10Phase.CLOSED) paused = false }

    fun failClosed() {
        if (phase == N10Phase.CLOSED) return
        generation++
        phase = N10Phase.FAILED
        refreshed = false
        reportedCanRequestAds = false
        fit = null
    }

    fun withdrawn() {
        if (phase == N10Phase.CLOSED) return
        generation++
        phase = N10Phase.WITHDRAWN
        refreshed = false
        reportedCanRequestAds = false
        fit = null
    }

    fun close() {
        generation++
        phase = N10Phase.CLOSED
        refreshed = false
        reportedCanRequestAds = false
        fit = null
        paused = true
    }
}
