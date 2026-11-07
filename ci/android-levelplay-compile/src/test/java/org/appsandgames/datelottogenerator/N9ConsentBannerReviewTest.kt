package org.appsandgames.datelottogenerator

import org.junit.Assert.*
import org.junit.Test

/** Offline JVM-only N9 gates. Never start Android, UMP or Unity SDK. */
class N9ConsentBannerReviewTest {
    private val anchor = NativeBannerAnchorBounds(100, 100, 800, 125)

    private fun evaluate(choice: N9UserChoice, verified: Boolean = true): N9ReviewResult =
        N9ConsentBannerReview.reviewOnly(
            evidence = N9ConsentEvidence(
                refreshedThisLaunch = verified,
                formCompletedWithoutError = verified,
                umpCanRequestAds = true, // UMP readiness is NOT affirmative opt-in.
                choice = choice,
                approvedVendorAndPurposeEvidence = verified,
                audienceReviewed = verified,
                privacyOptionsEntryPointVerified = verified,
                withdrawalCleanupReviewed = verified,
                huaweiRegisteredAsTestDevice = verified
            ),
            anchor = anchor, density = 2.5f, rootWidthPx = 2560, rootHeightPx = 1600
        )

    @Test fun refusedAfterPreviouslyReportedUmpReadinessStillBlocks() {
        val outcome = evaluate(N9UserChoice.REJECTED)
        assertNull(outcome.n5Placement)
        assertFalse(outcome.consentAndTestDeviceReviewReady)
        assertFalse(outcome.requestTestAdAllowed)
    }

    @Test fun withdrawnImmediatelyDiscardsPlacementAndRequests() {
        val outcome = evaluate(N9UserChoice.WITHDRAWN)
        assertNull(outcome.n5Placement)
        assertFalse(outcome.consentAndTestDeviceReviewReady)
        assertFalse(outcome.requestTestAdAllowed)
    }

    @Test fun unknownConsentRemainsBlockedWithoutSdkObjectConstruction() {
        val result = N9ConsentBannerReview.reviewOnly(
            N9ConsentEvidence(umpCanRequestAds = true),
            null, 2.5f, 2560, 1600
        )
        assertNull(result.n5Placement)
        assertFalse(result.consentAndTestDeviceReviewReady)
        assertFalse(result.requestTestAdAllowed)
    }

    @Test fun debugWithdrawalResetNeverAuthorizesAdRequests() {
        val result = N9ConsentBannerReview.afterRefusalOrWithdrawal()
        assertNull(result.n5Placement)
        assertFalse(result.consentAndTestDeviceReviewReady)
        assertFalse(result.requestTestAdAllowed)
    }
}
