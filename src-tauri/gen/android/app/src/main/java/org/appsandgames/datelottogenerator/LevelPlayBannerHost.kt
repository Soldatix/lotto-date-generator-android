package org.appsandgames.datelottogenerator

import android.app.Activity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout

/**
 * Native ViewGroup host for a future 320x50 dp LevelPlay banner.
 *
 * This is inert by default: MainActivity NEVER instantiates or calls it.
 * It must only be installed after the site/app privacy flow has been reviewed,
 * consent obtained, and the real Tauri Android view hierarchy tested on device.
 *
 * Unlike an overlay above the WebView, this reserves its own 50dp strip BELOW
 * the current Tauri content by reparenting the single Activity content child.
 * This operation is not yet device verified: do not call in production.
 */
internal class LevelPlayBannerHost(private val activity: Activity) {
    private var container: FrameLayout? = null
    private var wrapper: LinearLayout? = null
    private var original: View? = null

    /**
     * Developer-only native host method. Has no ad SDK dependency.
     * Returns null if the Tauri root differs from the expected hierarchy.
     * Android main/UI thread only.
     */
    fun reserveBottomStripAfterReview(): FrameLayout? {
        check(android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            "Native banner host must be accessed from the Android main thread"
        }
        container?.let { return it }
        val content = activity.findViewById<FrameLayout>(android.R.id.content) ?: return null
        if (content.childCount != 1) return null
        val webRoot = content.getChildAt(0) ?: return null
        if (webRoot.parent !== content) return null

        val column = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        val bannerSpace = FrameLayout(activity).apply {
            contentDescription = "Advertisement area (inactive)"
            visibility = View.GONE // No extra space or ad impression before actual approval.
        }
        content.removeView(webRoot)
        column.addView(
            webRoot,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
            )
        )
        column.addView(
            bannerSpace,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                (50 * activity.resources.displayMetrics.density + 0.5f).toInt()
            )
        )
        content.addView(
            column,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        wrapper = column
        container = bannerSpace
        original = webRoot
        return bannerSpace
    }

    fun release() {
        check(android.os.Looper.myLooper() == android.os.Looper.getMainLooper())
        val column = wrapper ?: return
        val child = original ?: return
        val root = activity.findViewById<FrameLayout>(android.R.id.content) ?: return
        if (column.parent === root && child.parent === column) {
            column.removeView(child)
            root.removeView(column)
            root.addView(child)
        }
        container = null
        wrapper = null
        original = null
    }
}
