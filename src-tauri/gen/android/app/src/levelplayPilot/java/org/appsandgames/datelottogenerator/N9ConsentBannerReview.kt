package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import com.google.android.ump.UserMessagingPlatform
import com.google.android.ump.ConsentInformation
import com.unity3d.mediation.LevelPlayAdSize

/**
 * N9 COMPILE/REVIEW ONLY: bridge between the UMP privacy status and the
 * previously verified N5 Android native banner rectangle.
 *
 * Included only in the explicitly requested isolated debug LevelPlay source set.
 * Never called by MainActivity, N7, or N8. No SDK init, banner construction,
 * privacy metadata writes, advertising ID, tracking or ad request here.
 *
 * canRequestAds() is UMP transport readiness, NOT proof of an affirmative
 * choice for personalised ads, and NEVER sufficient to enable LevelPlay.
 */
internal enum class N9UserChoice {
    NOT_CHECKED, ACCEPTED_AFTER_REVIEW, REJECTED, WITHDRAWN
}

internal data class N9ConsentEvidence(
    val refreshedThisLaunch: Boolean = false,
    val formCompletedWithoutError: Boolean = false,
    val umpCanRequestAds: Boolean = false,
    val choice: N9UserChoice = N9UserChoice.NOT_CHECKED,
    val approvedVendorAndPurposeEvidence: Boolean = false,
    val audienceReviewed: Boolean = false,
    val privacyOptionsEntryPointVerified: Boolean = false,
    val withdrawalCleanupReviewed: Boolean = false,
    val huaweiRegisteredAsTestDevice: Boolean = false
)

internal data class N9ReviewResult(
    val n5Placement: N4BannerPixelPlacement?,
    val consentAndTestDeviceReviewReady: Boolean,
    // This must NEVER change before separate owner approval of test requests.
    val requestTestAdAllowed: Boolean = false
)

internal object N9ConsentBannerReview {
    private const val PILOT_PACKAGE =
        "org.appsandgames.datelottogenerator.levelplaypilot"
    private const val N9_REAL_TEST_AD_REQUESTS_APPROVED = false

    /**
     * Read-only diagnostic; no CMP refresh is initiated here. The caller must
     * obtain UMP status after a fresh requestConsentInfoUpdate/form callback.
     */
    fun readUmpEvidenceForLaterReview(
        activity: Activity,
        refreshedThisLaunch: Boolean,
        formCompletedWithoutError: Boolean,
        choice: N9UserChoice,
        approvedVendorAndPurposeEvidence: Boolean,
        audienceReviewed: Boolean,
        privacyOptionsEntryPointVerified: Boolean,
        withdrawalCleanupReviewed: Boolean,
        huaweiRegisteredAsTestDevice: Boolean
    ): N9ConsentEvidence {
        if (activity.packageName != PILOT_PACKAGE ||
            (activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            return N9ConsentEvidence()
        }
        val ump = UserMessagingPlatform.getConsentInformation(activity)
        val optionsRequired = ump.privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        return N9ConsentEvidence(
            refreshedThisLaunch = refreshedThisLaunch,
            formCompletedWithoutError = formCompletedWithoutError,
            umpCanRequestAds = ump.canRequestAds(),
            choice = choice,
            approvedVendorAndPurposeEvidence = approvedVendorAndPurposeEvidence,
            audienceReviewed = audienceReviewed,
            privacyOptionsEntryPointVerified = privacyOptionsEntryPointVerified && optionsRequired,
            withdrawalCleanupReviewed = withdrawalCleanupReviewed,
            huaweiRegisteredAsTestDevice = huaweiRegisteredAsTestDevice
        )
    }

    /** Reuse N5's native anchor + N4 exact 320x50dp fit; never crop creatives. */
    fun examineN5Slot(
        anchor: NativeBannerAnchorBounds?,
        density: Float,
        rootWidthPx: Int,
        rootHeightPx: Int
    ): N4BannerPixelPlacement? {
        val actualAnchor = anchor ?: return null
        val size = LevelPlayAdSize.BANNER
        return N4BannerSizeFitPolicy.fit(
            actualAnchor, size.width, size.height,
            density, rootWidthPx, rootHeightPx
        )
    }

    fun reviewOnly(
        evidence: N9ConsentEvidence,
        anchor: NativeBannerAnchorBounds?,
        density: Float,
        rootWidthPx: Int,
        rootHeightPx: Int
    ): N9ReviewResult {
        // Refusal or withdrawal immediately discards any previously eligible
        // geometry; an ad must never remain visible on revoked permission.
        if (evidence.choice == N9UserChoice.REJECTED ||
            evidence.choice == N9UserChoice.WITHDRAWN) {
            return afterRefusalOrWithdrawal()
        }
        val placement = examineN5Slot(anchor, density, rootWidthPx, rootHeightPx)
        val readyForFurtherReview =
            placement != null &&
            evidence.refreshedThisLaunch &&
            evidence.formCompletedWithoutError &&
            evidence.umpCanRequestAds &&
            evidence.choice == N9UserChoice.ACCEPTED_AFTER_REVIEW &&
            evidence.approvedVendorAndPurposeEvidence &&
            evidence.audienceReviewed &&
            evidence.privacyOptionsEntryPointVerified &&
            evidence.withdrawalCleanupReviewed &&
            evidence.huaweiRegisteredAsTestDevice

        // Always false even if every review flag is TRUE.
        return N9ReviewResult(
            n5Placement = placement,
            consentAndTestDeviceReviewReady = readyForFurtherReview,
            requestTestAdAllowed = N9_REAL_TEST_AD_REQUESTS_APPROVED && false
        )
    }

    /** Called in the future after a refusal/withdrawal: revoke all candidates. */
    fun afterRefusalOrWithdrawal(): N9ReviewResult = N9ReviewResult(
        n5Placement = null,
        consentAndTestDeviceReviewReady = false,
        requestTestAdAllowed = false
    )
}
