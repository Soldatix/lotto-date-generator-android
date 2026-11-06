package org.appsandgames.datelottogenerator

/**
 * N6 offline publisher readiness checklist ONLY, not a provider or consent API.
 * It never contains real IDs/secrets, never performs I/O and never starts ads.
 *
 * Setting ALL of these flags true is still NOT permission to request an ad.
 */
internal data class N6AdMobReadiness(
    val developerAccountVerified: Boolean = false,
    val adMobAccountConfirmed: Boolean = false,
    val androidApplicationCreatedInAdMob: Boolean = false,
    val appIdInApprovedPrivateConfiguration: Boolean = false,
    val privacyMessagePublishedInAdMob: Boolean = false,
    val mediationPartnerListReviewed: Boolean = false,
    val audienceClassificationReviewed: Boolean = false,
    val privacyNoticeReviewed: Boolean = false,
    val privacyOptionsAndWithdrawalReviewed: Boolean = false,
    val realDeviceConsentFlowReviewed: Boolean = false,
    val publicStoreLinkedAndAppReviewed: Boolean = false
)

internal object N6AdMobReadinessGate {
    private const val N6_RELEASE_AND_AD_REQUESTS_APPROVED = false

    /**
     * A public store link is a separate go-live requirement: an unpublished app
     * may be created in AdMob for preparations while its store review is pending.
     */
    fun missingForCmpPilot(e: N6AdMobReadiness): List<String> = buildList {
        if (!e.adMobAccountConfirmed) add("ADMOB_ACCOUNT_UNCONFIRMED")
        if (!e.androidApplicationCreatedInAdMob) add("ADMOB_ANDROID_APP_NOT_CREATED")
        if (!e.appIdInApprovedPrivateConfiguration) add("ADMOB_APP_ID_NOT_PRIVATELY_CONFIGURED")
        if (!e.privacyMessagePublishedInAdMob) add("CMP_MESSAGE_NOT_PUBLISHED")
        if (!e.mediationPartnerListReviewed) add("MEDIATION_PARTNERS_NOT_REVIEWED")
        if (!e.audienceClassificationReviewed) add("AUDIENCE_NOT_REVIEWED")
        if (!e.privacyNoticeReviewed) add("PRIVACY_NOTICE_NOT_REVIEWED")
        if (!e.privacyOptionsAndWithdrawalReviewed) add("PRIVACY_OPTIONS_NOT_REVIEWED")
        if (!e.realDeviceConsentFlowReviewed) add("CONSENT_DEVICE_TEST_NOT_REVIEWED")
    }

    fun missingForRelease(e: N6AdMobReadiness): List<String> = buildList {
        addAll(missingForCmpPilot(e))
        if (!e.developerAccountVerified) add("STORE_DEVELOPER_ACCOUNT_PENDING")
        if (!e.publicStoreLinkedAndAppReviewed) add("PUBLIC_STORE_AND_ADMOB_REVIEW_PENDING")
    }

    // Absolutely no true path in N6: a fully positive mock is NOT authorization.
    fun canInitializeSdkOrRequestAds(e: N6AdMobReadiness): Boolean =
        N6_RELEASE_AND_AD_REQUESTS_APPROVED &&
        missingForRelease(e).isEmpty()
}
