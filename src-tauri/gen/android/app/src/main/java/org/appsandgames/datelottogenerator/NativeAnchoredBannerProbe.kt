package org.appsandgames.datelottogenerator

import android.app.Activity
import android.graphics.Color
import android.graphics.Rect
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.View
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.TextView
import org.json.JSONObject
import org.json.JSONTokener
import kotlin.math.roundToInt

/**
 * EXPERIMENTAL: read-only WebView DOM geometry -> Android native VIEW placement.
 *
 * Only the surrounding NativeBannerHostProbe can instantiate this object, and
 * only after exact pilot package + FLAG_DEBUGGABLE + TWO explicit ADB booleans.
 * This class imports NO advertising SDK, stores no keys/IDs, makes NO requests
 * and never calls addJavascriptInterface() or alters the production activity.
 *
 * The HTML mock reserves normal-flow space. This native TextView overlays only
 * that reserved rectangle; no ViewWeb reparenting and no system-bar overlay.
 * Actual ad placement/consent remains unapproved.
 */
internal class NativeAnchoredBannerProbe(private val activity: Activity) {
    companion object {
        private const val TAG = "DateLottoNativeAnchor"
        private const val SAMPLE_MS = 450L
        private const val PAGE_HOST = "tauri.localhost"
        private const val N3_SDK_PLACEMENT_HANDOFF_APPROVED = false
    }

    private var root: FrameLayout? = null
    private var web: WebView? = null
    private var nativeLabel: TextView? = null
    private var enabled = false
    private var paused = false
    private var lastVisible = false
    private var anchorListener: NativeBannerAnchorListener? = null
    private val ticker = Runnable { sample() }

    /**
     * Reserved future handoff to an opt-in, review-approved native SDK host.
     * MainActivity and production never register this listener. No SDK types
     * are imported here; default N1 still renders the same native TextView.
     */
    fun registerPlacementListenerForFutureReview(
        listener: NativeBannerAnchorListener
    ) {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (activity.packageName != "org.appsandgames.datelottogenerator.levelplaypilot") return
        if ((activity.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return
        // Critical: N3 handoff remains compiled but unreachable.
        if (!N3_SDK_PLACEMENT_HANDOFF_APPROVED) return
        anchorListener = listener
    }

    fun start(content: FrameLayout, webView: WebView) {
        check(Looper.myLooper() == Looper.getMainLooper())
        if (enabled || activity.isDestroyed || activity.isFinishing) return
        if (content.width <= 0 || webView.width <= 0) return

        val label = TextView(activity).apply {
            text = "NATIVE ANDROID VIEW · NO ADS"
            textSize = 12f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(24, 85, 184))
            contentDescription = "Debug-only native Android banner location test without ads"
            isClickable = false
            isFocusable = false
            visibility = View.GONE
        }
        content.addView(label, FrameLayout.LayoutParams(
            1, 1, Gravity.TOP or Gravity.START
        ))
        root = content
        web = webView
        nativeLabel = label
        enabled = true
        paused = false
        content.post(ticker)
        Log.i(TAG, "NATIVE_ANCHOR=STARTED_NO_ADS")
    }

    private fun sample() {
        val parent = root ?: return
        val browser = web ?: return
        if (!enabled || paused || activity.isDestroyed || activity.isFinishing) return
        if (!browser.isAttachedToWindow || browser.width <= 0 || browser.height <= 0) {
            conceal()
            next()
            return
        }

        // Returns an encoded JSON string, not a JS->native interface.
        // Keep this query local-only: do not evaluate anything supplied by
        // page content, network responses, settings, or user input.
        val script = """
            (function() {
              if (location.hostname !== 'tauri.localhost') return null;
              var slot = document.getElementById('nativeTabletBannerProbe');
              if (!slot || slot.hidden || !slot.closest('.resultBox.tablet-preview-active'))
                return null;
              var b = slot.getBoundingClientRect();
              var st = getComputedStyle(slot);
              if (st.display === 'none' || st.visibility === 'hidden') return null;
              if (b.left < 0 || b.top < 0 || b.right > innerWidth ||
                  b.bottom > innerHeight || b.width < 120 || b.height < 30)
                return null;
              return JSON.stringify({
                x:b.left,y:b.top,w:b.width,h:b.height,
                vw:innerWidth,vh:innerHeight
              });
            })()
        """.trimIndent()

        browser.evaluateJavascript(script) { value ->
            if (!enabled || paused || activity.isDestroyed || activity.isFinishing) return@evaluateJavascript
            val details = try {
                val parsed = JSONTokener(value ?: "null").nextValue() as? String
                if (parsed != null) JSONObject(parsed) else null
            } catch (_: RuntimeException) {
                null
            }
            if (details == null || !place(details, parent, browser)) conceal()
            next()
        }
    }

    private fun place(data: JSONObject, parent: FrameLayout, browser: WebView): Boolean {
        val x = data.optDouble("x", Double.NaN)
        val y = data.optDouble("y", Double.NaN)
        val w = data.optDouble("w", Double.NaN)
        val h = data.optDouble("h", Double.NaN)
        val vw = data.optDouble("vw", Double.NaN)
        val vh = data.optDouble("vh", Double.NaN)
        if (listOf(x, y, w, h, vw, vh).any { !it.isFinite() }) return false
        if (vw < 300.0 || vh < 200.0 || browser.width <= 0 || browser.height <= 0) return false

        val sx = browser.width.toDouble() / vw
        val sy = browser.height.toDouble() / vh
        // WebView's density/zoom mapping must agree in both axes.
        if (sx < 0.5 || sx > 5.0 || sy < 0.5 || sy > 5.0) return false
        if (kotlin.math.abs(sx - sy) > sx * 0.08) return false
        if (x < 0 || y < 0 || w < 120 || h < 30 ||
            x + w > vw + 1 || y + h > vh + 1) return false

        val rootPos = IntArray(2)
        val webPos = IntArray(2)
        parent.getLocationOnScreen(rootPos)
        browser.getLocationOnScreen(webPos)
        val left = webPos[0] - rootPos[0] + (x * sx).roundToInt()
        val top = webPos[1] - rootPos[1] + (y * sy).roundToInt()
        val width = (w * sx).roundToInt()
        val height = (h * sy).roundToInt()
        if (width < 40 || height < 30 || left < 0 || top < 0 ||
            left + width > parent.width || top + height > parent.height) return false

        // Visible frame includes the safety boundary for 3-button/gesture
        // navigation and IME on this Android API. Fail closed if obscured.
        val visible = Rect()
        parent.getWindowVisibleDisplayFrame(visible)
        val gap = (4f * activity.resources.displayMetrics.density).roundToInt()
        val screenLeft = rootPos[0] + left
        val screenTop = rootPos[1] + top
        if (screenLeft < visible.left + gap || screenTop < visible.top + gap ||
            screenLeft + width > visible.right - gap ||
            screenTop + height > visible.bottom - gap) return false

        val label = nativeLabel ?: return false
        val params = FrameLayout.LayoutParams(width, height, Gravity.TOP or Gravity.START)
        params.leftMargin = left
        params.topMargin = top
        label.layoutParams = params
        label.visibility = View.VISIBLE
        anchorListener?.onAnchorVisible(
            NativeBannerAnchorBounds(left, top, width, height)
        )
        if (!lastVisible) {
            Log.i(TAG, "NATIVE_ANCHOR=ALIGNED_NO_ADS x=$left y=$top w=$width h=$height")
        }
        lastVisible = true
        return true
    }

    private fun conceal() {
        nativeLabel?.visibility = View.GONE
        anchorListener?.onAnchorHidden()
        if (lastVisible) Log.i(TAG, "NATIVE_ANCHOR=HIDDEN_OFFSCREEN_OR_SYSTEM_INSET")
        lastVisible = false
    }

    private fun next() {
        if (enabled && !paused) root?.postDelayed(ticker, SAMPLE_MS)
    }

    fun pause() {
        paused = true
        root?.removeCallbacks(ticker)
        conceal()
    }

    fun resume() {
        if (!enabled || !paused) return
        paused = false
        root?.post(ticker)
    }

    fun release() {
        check(Looper.myLooper() == Looper.getMainLooper())
        enabled = false
        paused = true
        root?.removeCallbacks(ticker)
        conceal()
        val view = nativeLabel
        val parent = root
        if (view != null && parent != null && view.parent === parent) {
            parent.removeView(view)
        }
        nativeLabel = null
        anchorListener?.onAnchorReleased()
        anchorListener = null
        web = null
        root = null
        Log.i(TAG, "NATIVE_ANCHOR=RELEASED_NO_ADS")
    }
}
