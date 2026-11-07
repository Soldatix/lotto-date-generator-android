package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.util.Log
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * N7: real Google UMP FORM test in an isolated debug-only activity.
 * This is NOT a banner, and cannot request or initialize ANY ads.
 *
 * Requires exact pilot package + debuggable + explicit ADB extra.
 * The N7 Gradle opt-in adds this source and manifest; release/normal
 * builds exclude both and do not include Google's UMP dependency.
 */
internal class N7UmpPreviewActivity : Activity() {
    companion object {
        private const val TAG = "DateLottoN7UMP"
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val EXTRA_PREVIEW =
            "org.appsandgames.datelottogenerator.DEBUG_N7_UMP_PREVIEW"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val isPilot = packageName == PILOT_PACKAGE &&
            (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        if (!isPilot || intent?.getBooleanExtra(EXTRA_PREVIEW, false) != true) {
            Log.w(TAG, "N7_UMP=BLOCKED_DEBUG_PACKAGE_OR_EXPLICIT_EXTRA")
            finish()
            return
        }

        // May contact the UMP consent service: user-run debug test ONLY.
        // Never query advertising ID, never start LevelPlay or load an ad.
        Log.i(TAG, "N7_UMP=REFRESH_STARTED_NO_ADS")
        val info = UserMessagingPlatform.getConsentInformation(this)
        val params = ConsentRequestParameters.Builder().build()
        info.requestConsentInfoUpdate(
            this,
            params,
            {
                if (!isFinishing && !isDestroyed) {
                    Log.i(TAG, "N7_UMP=REFRESH_OK_NO_ADS")
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { error ->
                        if (error == null) {
                            Log.i(TAG, "N7_UMP=FORM_COMPLETED_OR_NOT_REQUIRED_NO_ADS")
                        } else {
                            Log.w(TAG, "N7_UMP=FORM_ERROR_NO_ADS")
                        }
                        finish()
                    }
                }
            },
            {
                Log.w(TAG, "N7_UMP=REFRESH_ERROR_NO_ADS")
                finish()
            }
        )
    }
}
