package org.appsandgames.datelottogenerator

import org.junit.Assert.*
import org.junit.Test

/** Offline N6 test: no account lookup, UMP invocation, API keys or ads. */
class N6AdMobReadinessGateTest {
    private val reviewedCmpPilot = N6AdMobReadiness(
        adMobAccountConfirmed = true,
        androidApplicationCreatedInAdMob = true,
        appIdInApprovedPrivateConfiguration = true,
        privacyMessagePublishedInAdMob = true,
        mediationPartnerListReviewed = true,
        audienceClassificationReviewed = true,
        privacyNoticeReviewed = true,
        privacyOptionsAndWithdrawalReviewed = true,
        realDeviceConsentFlowReviewed = true
    )

    @Test fun unknownAccountAndOpPoPendingRemainBlocked() {
        val missing = N6AdMobReadinessGate.missingForRelease(N6AdMobReadiness())
        assertTrue(missing.contains("ADMOB_ACCOUNT_UNCONFIRMED"))
        assertTrue(missing.contains("STORE_DEVELOPER_ACCOUNT_PENDING"))
        assertTrue(missing.contains("CMP_MESSAGE_NOT_PUBLISHED"))
        assertFalse(N6AdMobReadinessGate.canInitializeSdkOrRequestAds(N6AdMobReadiness()))
    }

    @Test fun unpublishedStoreDoesNotBlockPreparingCmpButBlocksRelease() {
        assertTrue(N6AdMobReadinessGate.missingForCmpPilot(reviewedCmpPilot).isEmpty())
        val missingRelease = N6AdMobReadinessGate.missingForRelease(reviewedCmpPilot)
        assertTrue(missingRelease.contains("PUBLIC_STORE_AND_ADMOB_REVIEW_PENDING"))
        assertTrue(missingRelease.contains("STORE_DEVELOPER_ACCOUNT_PENDING"))
        assertFalse(N6AdMobReadinessGate.canInitializeSdkOrRequestAds(reviewedCmpPilot))
    }

    @Test fun positiveSyntheticEverythingStillNeverAuthorizesAds() {
        val all = reviewedCmpPilot.copy(
            developerAccountVerified = true,
            publicStoreLinkedAndAppReviewed = true
        )
        assertTrue(N6AdMobReadinessGate.missingForRelease(all).isEmpty())
        assertFalse(N6AdMobReadinessGate.canInitializeSdkOrRequestAds(all))
    }

    @Test fun missingPrivacyOrPartnerReviewMustBlockCmpReadiness() {
        val missing=N6AdMobReadinessGate.missingForCmpPilot(
            reviewedCmpPilot.copy(
                mediationPartnerListReviewed=false,
                privacyOptionsAndWithdrawalReviewed=false
            )
        )
        assertTrue(missing.contains("MEDIATION_PARTNERS_NOT_REVIEWED"))
        assertTrue(missing.contains("PRIVACY_OPTIONS_NOT_REVIEWED"))
    }
}
