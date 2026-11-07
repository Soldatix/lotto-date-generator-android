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
internal class NativeBannerHostProbe(
    private val activity: Activity,
    private val n12OnlyListener: NativeBannerAnchorListener? = null
) {
    companion object {
        private const val TAG = "DateLottoNativeHost"
        private const val PILOT_PACKAGE =
            "org.appsandgames.datelottogenerator.levelplaypilot"
        private const val EXTRA_ENABLE =
            "org.appsandgames.datelottogenerator.DEBUG_NATIVE_BANNER_PROBE"
        private const val EXTRA_NATIVE_ANCHOR =
            "org.appsandgames.datelottogenerator.DEBUG_NATIVE_ANCHORED_PREVIEW"
        private const val EXTRA_N5_PORTRAIT_RAIL =
            "org.appsandgames.datelottogenerator.DEBUG_N5_PORTRAIT_RAIL"
    }

    private val host = LevelPlayBannerHost(activity)
    private var anchored: NativeAnchoredBannerProbe? = null
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
        // N5 requires a THIRD explicit ADB boolean; ordinary N1/N2 unchanged.
        val n5Requested =
            activity.intent?.getBooleanExtra(EXTRA_N5_PORTRAIT_RAIL, false) == true &&
            activity.intent?.getBooleanExtra(EXTRA_NATIVE_ANCHOR, false) == true
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
              if (__N5_PORTRAIT_RAIL__) {
                var grid = panel.closest('.grid');
                if (!grid) return false;
                // Only the existing no-ad HTML slot moves; no SDK or ads.
                var cssId = 'date-lotto-n5-portrait-rail';
                if (!document.getElementById(cssId)) {
                  var n5css = document.createElement('style');
                  n5css.id = cssId;
                  n5css.textContent =
                    '@media (orientation: portrait) {' +
                    '.grid.n5-tablet-portrait-rail>#nativeTabletBannerProbe {' +
                    'grid-column:1/-1;justify-self:center;align-self:start;' +
                    'width:320px;max-width:100%;height:50px;' +
                    'margin:12px auto 0!important;}' +
                    '}';
                  document.head.appendChild(n5css);
                }
                if (!window.__dateLottoN5RailInstalled) {
                  window.__dateLottoN5RailInstalled = true;
                  var syncN5 = function() {
                    var portrait = window.matchMedia('(orientation: portrait)').matches;
                    var target = portrait ? grid : panel;
                    if (slot.parentElement !== target) target.appendChild(slot);
                    if (portrait) grid.classList.add('n5-tablet-portrait-rail');
                    else grid.classList.remove('n5-tablet-portrait-rail');
                    slot.hidden = portrait && grid.getBoundingClientRect().width < 320;
                  };
                  window.addEventListener('resize', syncN5);
                  window.addEventListener('orientationchange', syncN5);
                  syncN5();
                }
              }
              return true;
            })()
        """.trimIndent().replace("__N5_PORTRAIT_RAIL__", n5Requested.toString())

        web.evaluateJavascript(script) { result ->
            if (activity.isFinishing || activity.isDestroyed || attached) return@evaluateJavascript
            if (result == "true") {
                attached = true
                Log.i(TAG, "HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS")
                // Separate, mandatory second ADB opt-in. Existing V8.2
                // tablet HTML preview stays completely unchanged by default.
                if (activity.intent?.getBooleanExtra(EXTRA_NATIVE_ANCHOR, false) == true) {
                    anchored = NativeAnchoredBannerProbe(activity).also {
                        // N12 is a distinct opt-in debug Activity; production
                        // keeps its old listener-free path and N3 stays off.
                        n12OnlyListener?.let { listener ->
                            it.registerN12IsolatedBannerListener(listener)
                        }
                        it.start(root, web)
                    }
                }
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

    fun pause() {
        anchored?.pause()
    }

    fun resume() {
        anchored?.resume()
    }

    fun detach() {
        anchored?.release()
        anchored = null
        host.release()
        attached = false
    }
}
