package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * N8: owner-operated Huawei consent choices / withdrawal TEST UI.
 * Compiled ONLY by the same explicit n7ConsentPilot debug-only UMP opt-in.
 * NO Unity SDK, NO ads, NO advertising ID, NO consent strings in logcat.
 * Never instantiate this from MainActivity or a release build.
 */
internal class N8UmpPrivacyOptionsActivity : Activity() {
    companion object {
        private const val TAG = "DateLottoN8UMP"
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val EXTRA_PRIVACY =
            "org.appsandgames.datelottogenerator.DEBUG_N8_UMP_PRIVACY"
    }

    private val info by lazy { UserMessagingPlatform.getConsentInformation(this) }
    private lateinit var status: TextView
    private lateinit var privacyButton: Button
    private lateinit var resetButton: Button
    private var fetching = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val allowed = packageName == PILOT_PACKAGE &&
            (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 &&
            intent?.getBooleanExtra(EXTRA_PRIVACY, false) == true
        if (!allowed) {
            Log.w(TAG, "N8_UMP=BLOCKED_DEBUG_PACKAGE_OR_EXPLICIT_EXTRA")
            finish()
            return
        }

        val density = resources.displayMetrics.density
        val margin = (20f * density).toInt()
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(margin, margin, margin, margin)
        }
        val title = TextView(this).apply {
            textSize = 21f
            text = "Date Lotto — test privatnosti"
        }
        status = TextView(this).apply {
            textSize = 16f
            text = "Google UMP: dohvaćanje postavki…"
        }
        privacyButton = Button(this).apply {
            text = "Upravljanje opcijama"
            isEnabled = false
            setOnClickListener {
                if (!fetching && info.privacyOptionsRequirementStatus ==
                    ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
                ) {
                    Log.i(TAG, "N8_UMP=PRIVACY_OPTIONS_OPENED_NO_ADS")
                    privacyButton.isEnabled = false
                    UserMessagingPlatform.showPrivacyOptionsForm(
                        this@N8UmpPrivacyOptionsActivity
                    ) { error ->
                        if (error == null) {
                            Log.i(TAG, "N8_UMP=PRIVACY_OPTIONS_CLOSED_OK_NO_ADS")
                        } else {
                            Log.w(TAG, "N8_UMP=PRIVACY_OPTIONS_FORM_ERROR_NO_ADS")
                        }
                        updateUi()
                    }
                }
            }
        }
        resetButton = Button(this).apply {
            text = "Ponovi prvi obrazac (SAMO TEST)"
            isEnabled = false
            setOnClickListener {
                if (!fetching) {
                    // Google's reset() is for debug/test ONLY, never production.
                    info.reset()
                    Log.i(TAG, "N8_UMP=DEBUG_RESET_FOR_TEST_ONLY")
                    refreshConsent()
                }
            }
        }
        val disclaimer = TextView(this).apply {
            text = "Izolirana debug aplikacija. Ne prikazuje i ne traži oglase. " +
                "Ponovi prvi obrazac briše samo testne UMP odluke."
        }
        layout.addView(title)
        layout.addView(status)
        layout.addView(privacyButton)
        layout.addView(resetButton)
        layout.addView(disclaimer)
        setContentView(layout)
        refreshConsent()
    }

    private fun refreshConsent() {
        if (fetching || isFinishing || isDestroyed) return
        fetching = true
        privacyButton.isEnabled = false
        resetButton.isEnabled = false
        status.text = "Dohvat UMP postavki…"
        Log.i(TAG, "N8_UMP=REFRESH_STARTED_NO_ADS")
        info.requestConsentInfoUpdate(
            this,
            ConsentRequestParameters.Builder().build(),
            {
                if (!isFinishing && !isDestroyed) {
                    Log.i(TAG, "N8_UMP=REFRESH_OK_NO_ADS")
                    UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) { error ->
                        if (error == null) {
                            Log.i(TAG, "N8_UMP=FORM_DONE_OR_NOT_REQUIRED_NO_ADS")
                        } else {
                            Log.w(TAG, "N8_UMP=FORM_ERROR_NO_ADS")
                        }
                        fetching = false
                        updateUi()
                    }
                }
            },
            {
                Log.w(TAG, "N8_UMP=REFRESH_ERROR_NO_ADS")
                fetching = false
                updateUi()
            }
        )
    }

    private fun updateUi() {
        if (isFinishing || isDestroyed) return
        val required = info.privacyOptionsRequirementStatus ==
            ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED
        // A readiness flag is diagnostic, never an instruction to request ads.
        val readiness = info.canRequestAds()
        status.text = "UMP spremnost (informativno): $readiness\n" +
            "Upravljanje opcijama obavezno: $required\n" +
            "Oglasi: ISKLJUČENI"
        privacyButton.isEnabled = required && !fetching
        resetButton.isEnabled = !fetching
        Log.i(TAG, if (required) "N8_UMP=PRIVACY_ENTRY_REQUIRED_NO_ADS"
                   else "N8_UMP=PRIVACY_ENTRY_NOT_REQUIRED_NO_ADS")
    }
}
