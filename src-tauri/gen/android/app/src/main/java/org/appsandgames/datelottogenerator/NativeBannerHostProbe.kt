package org.appsandgames.datelottogenerator

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.TextView

/**
 * Developer-only Android ViewGroup diagnostic; absolutely no ad SDK.
 *
 * Default launches remain unchanged. This probe requires ALL of:
 *   1. A debuggable APK,
 *   2. The exact isolated .levelplaypilot package, and
 *   3. An explicit boolean Intent extra from a controlled ADB start.
 *
 * This is NOT a consent flow, SDK initialization or advertising test.
 */
internal class NativeBannerHostProbe(private val activity: Activity) {
    companion object {
        private const val TAG = "DateLottoNativeHost"
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val EXTRA_ENABLE =
            "org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE"
    }

    private val host = LevelPlayBannerHost(activity)
    private var attached = false

    fun scheduleIfRequested() {
        if (activity.packageName != PILOT_PACKAGE) return
        if ((activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) == 0) return
        if (activity.intent?.getBooleanExtra(EXTRA_ENABLE, false) != true) return

        val root = activity.findViewById<FrameLayout>(android.R.id.content)
        if (root == null) {
            Log.w(TAG, "HOST_PROBE=NO_ACTIVITY_ROOT")
            return
        }

        // Allow Tauri's asynchronous WebView attachment to complete.
        // Bounded retries only when the content root is temporarily empty.
        root.post { attachWhenReady(root, 0) }
    }

    private fun attachWhenReady(root: FrameLayout, attempt: Int) {
        if (activity.isFinishing || activity.isDestroyed || attached) return
        if (root.childCount == 0 && attempt < 4) {
            root.postDelayed({ attachWhenReady(root, attempt + 1) }, 250L)
            return
        }
        val childTypes = (0 until root.childCount).joinToString(",") {
            root.getChildAt(it).javaClass.simpleName
        }
        Log.i(TAG, "HOST_PROBE=ROOT_LAYOUT children=${root.childCount} types=$childTypes")

        // Tablet: an actual Android ad view cannot live inside an HTML panel.
        // Reveal a strictly debug-only HTML placement mock INSIDE the result
        // panel; never place a native overlay across Android navigation keys.
        if (activity.resources.configuration.smallestScreenWidthDp >= 600) {
            showTabletPanelMock(root, attempt)
            return
        }

        try {
                val strip = host.reserveBottomStripAfterReview()
                if (strip == null) {
                    Log.w(TAG, "HOST_PROBE=ROOT_SHAPE_UNSUPPORTED")
                    return
                }
                val density = activity.resources.displayMetrics.density
                val widthPx = (320f * density + 0.5f).toInt()
                val preview = TextView(activity).apply {
                    text = "NATIVE BANNER HOST TEST - NO ADS"
                    textSize = 12f
                    gravity = Gravity.CENTER
                    setTextColor(Color.WHITE)
                    setBackgroundColor(Color.rgb(32, 65, 100))
                    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                    contentDescription = "Native 320 by 50 dp banner space test, no ads"
                }
                strip.addView(preview, FrameLayout.LayoutParams(
                    minOf(widthPx, activity.resources.displayMetrics.widthPixels),
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER
                ))
                strip.visibility = View.VISIBLE
                attached = true
                Log.i(TAG, "HOST_PROBE=ATTACHED_NO_ADS")
        } catch (error: RuntimeException) {
            Log.e(TAG, "HOST_PROBE=SAFE_FAILURE_NO_ADS", error)
            host.release()
        }
    }

    private fun findWebView(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                val match = findWebView(view.getChildAt(index))
                if (match != null) return match
            }
        }
        return null
    }

    private fun showTabletPanelMock(root: FrameLayout, attempt: Int) {
        val web = findWebView(root)
        if (web == null) {
            retryTabletMock(root, attempt)
            return
        }

        // The HTML node is permanently hidden by default. This debug-only
        // injection does not connect to a banner SDK, network, or CMP.
        val script = """
            (function() {
              var slot = document.getElementById('nativeTabletBannerProbe');
              if (!slot) return false;
              if (!(window.__TAURI_INTERNALS__ ||
                    location.hostname === 'tauri.localhost')) return false;
              var panel = slot.closest('.resultBox');
              if (!panel) return false;
              // Scoped runtime CSS is intentionally injected ONLY by the
              // debuggable, exact pilot package + explicit ADB Intent gates.
              // This works even if Android WebView serves stale bundled CSS.
              // Landscape: keep banner close to results and history.
              // Portrait: preserve the existing bottom-of-card placement.
              var styleId = 'date-lotto-tablet-debug-responsive-v82';
              if (!document.getElementById(styleId)) {
                var style = document.createElement('style');
                style.id = styleId;
                style.textContent =
                  '@media (orientation: landscape) {' +
                  '.resultBox.tablet-preview-active #resultArea.empty {' +
                  'margin:clamp(12px,2.5vh,24px) auto clamp(8px,2vh,18px) !important;}' +
                  '.resultBox.tablet-preview-active .native-tablet-banner-probe {' +
                  'margin:clamp(8px,1.5vh,16px) auto 0 !important;}' +
                  '}' +
                  '@media (orientation: portrait) {' +
                  '.resultBox.tablet-preview-active #resultArea.empty {' +
                  'margin:auto !important;}' +
                  '.resultBox.tablet-preview-active .native-tablet-banner-probe {' +
                  'margin:auto auto 0 !important;}' +
                  '}';
                document.head.appendChild(style);
              }
              panel.classList.add('tablet-preview-active');
              slot.hidden = false;
              return true;
            })()
        """.trimIndent()

        web.evaluateJavascript(script) { result ->
            if (activity.isFinishing || activity.isDestroyed || attached) return@evaluateJavascript
            if (result == "true") {
                attached = true
                Log.i(TAG, "HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS")
            } else {
                retryTabletMock(root, attempt)
            }
        }
    }

    private fun retryTabletMock(root: FrameLayout, attempt: Int) {
        if (attempt >= 20) {
            Log.w(TAG, "HOST_PROBE=TABLET_PANEL_NOT_READY_NO_ADS")
            return
        }
        root.postDelayed({ attachWhenReady(root, attempt + 1) }, 300L)
    }

    fun detach() {
        host.release()
        attached = false
    }
}
