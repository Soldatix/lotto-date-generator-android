package org.appsandgames.datelottogenerator

import android.app.Activity
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * N6 COMPILE-ONLY Google UMP 4.0.0 API compatibility draft.
 *
 * Optional LevelPlay-only source set; excluded from ordinary production/debug
 * builds. Unreachable via MainActivity. NO AdMob ID in source/manifest.
 * NEVER call this from an app without separately approved account configuration,
 * publisher-created privacy messages, partner review and implementation review.
 */
internal class N6UmpConsentApiDraft(private val activity: Activity) {
    companion object {
        private const val N6_UMP_RUNTIME_APPROVED = false
        private const val N6_ADMOB_CONFIGURATION_APPROVED = false
    }

    /**
     * Typecheck UMP's official per-launch refresh + form sequence.
     * Runtime hard-stop ALWAYS false. This is NOT a user-consent function and
     * its return value must NEVER be used to trigger a LevelPlay ad request.
     */
    fun beginFutureConsentFlowForReview(): Boolean {
        if (!N6_UMP_RUNTIME_APPROVED || !N6_ADMOB_CONFIGURATION_APPROVED) return false
        if (activity.packageName != "org.appsandgames.datelottogenerator.levelplaypilot" ||
            (activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0)
            return false

        val info = UserMessagingPlatform.getConsentInformation(activity)
        val request = ConsentRequestParameters.Builder().build()

        info.requestConsentInfoUpdate(
            activity, request,
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { _ ->
                    // A result from CMP alone is not authorization. In particular,
                    // "canRequestAds" might use a choice from a prior session.
                    // Future implementation must review partner-specific policy
                    // and prevent duplicate SDK requests.
                    val reportedCanRequestAds = info.canRequestAds()
                    val optionsRequired =
                        info.privacyOptionsRequirementStatus ==
                            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                    // This draft deliberately does not publish these signals,
                    // register callbacks, initialize an ad SDK or save state.
                    if (reportedCanRequestAds && optionsRequired) {
                        // No side effects: review-only branch.
                    }
                }
            },
            { _ ->
                // No fallback that starts ads on an error. Fail closed.
            }
        )
        return true // only means a request was scheduled; not consent or ad permission.
    }

    /** Draft of the user-invoked privacy options action; permanently disabled. */
    fun openPrivacyOptionsAfterReview(): Boolean {
        if (!N6_UMP_RUNTIME_APPROVED || !N6_ADMOB_CONFIGURATION_APPROVED) return false
        if (activity.packageName != "org.appsandgames.datelottogenerator.levelplaypilot") return false
        val info = UserMessagingPlatform.getConsentInformation(activity)
        if (info.privacyOptionsRequirementStatus !=
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED) return false
        UserMessagingPlatform.showPrivacyOptionsForm(activity) { _ -> }
        return true // not proof of consent and NEVER an ad-request signal.
    }
}
