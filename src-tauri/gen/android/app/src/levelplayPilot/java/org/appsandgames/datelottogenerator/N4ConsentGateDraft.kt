package org.appsandgames.datelottogenerator

/**
 * Consent architecture sketch in opt-in SDK source set only.
 * NOT a CMP implementation: no user identifiers, storage, SDK or network.
 */
internal enum class N4CmpOutcome {
    NOT_CHECKED, NEEDS_USER_CHOICE, READY_AS_REPORTED_BY_CMP,
    DENIED, WITHDRAWN, ERROR
}

internal data class N4CmpEvidence(
    val outcome: N4CmpOutcome = N4CmpOutcome.NOT_CHECKED,
    val refreshedThisLaunch: Boolean = false,
    val platformCanRequestAds: Boolean = false,
    val partnerAndPurposesReviewed: Boolean = false,
    val ageAudienceReviewed: Boolean = false,
    val privacyOptionsEntryPointReady: Boolean = false,
    val withdrawalHandlingReviewed: Boolean = false
)

internal object N4ConsentGateDraft {
    // Separate CMP, market/audience, network/legal review and approval needed.
    private const val N4_SDK_START_REVIEW_APPROVED = false

    fun evidenceReadyForFutureReview(e: N4CmpEvidence): Boolean =
        e.outcome == N4CmpOutcome.READY_AS_REPORTED_BY_CMP &&
        e.refreshedThisLaunch && e.platformCanRequestAds &&
        e.partnerAndPurposesReviewed && e.ageAudienceReviewed &&
        e.privacyOptionsEntryPointReady && e.withdrawalHandlingReviewed

    // ALWAYS FALSE for this pilot, even for entirely positive mock evidence.
    fun sdkInitializationPermitted(e: N4CmpEvidence): Boolean =
        N4_SDK_START_REVIEW_APPROVED && evidenceReadyForFutureReview(e)
}
