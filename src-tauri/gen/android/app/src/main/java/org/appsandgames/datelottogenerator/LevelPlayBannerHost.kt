package org.appsandgames.datelottogenerator

import android.app.Activity
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout

/**
 * No-ad native Android banner space experiment for the isolated debug pilot.
 *
 * Tauri may place more than one view under android.R.id.content; the previous
 * one-child reparenting assumption failed on Huawei CMR-W09 (Android 9).
 * This approach keeps every original child in the SAME parent and reserves
 * 50dp below it using reversible FrameLayout bottom margins.
 *
 * Never called from production: the caller has exact debug package,
 * debuggable flag and explicit Intent-extra gates. No LevelPlay API here.
 */
internal class LevelPlayBannerHost(private val activity: Activity) {
    private data class OriginalChild(
        val view: View,
        val layout: FrameLayout.LayoutParams
    )

    private var contentRoot: FrameLayout? = null
    private var container: FrameLayout? = null
    private var originals: List<OriginalChild> = emptyList()

    fun reserveBottomStripAfterReview(): FrameLayout? {
        check(android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            "Native banner host requires Android main thread"
        }
        container?.let { return it }

        val content = activity.findViewById<FrameLayout>(android.R.id.content) ?: return null
        if (content.childCount == 0) return null

        // A FrameLayout child with unexpected layout params must fail closed.
        // Do not reparent or remove any Tauri-owned view.
        val saved = mutableListOf<OriginalChild>()
        for (index in 0 until content.childCount) {
            val child = content.getChildAt(index) ?: return null
            val params = child.layoutParams as? FrameLayout.LayoutParams ?: return null
            if (child.parent !== content) return null
            saved.add(OriginalChild(child, params))
        }

        val heightPx = (50f * activity.resources.displayMetrics.density + 0.5f).toInt()
        if (heightPx <= 0) return null
        val bannerSpace = FrameLayout(activity).apply {
            contentDescription = "Native banner layout test, no ads"
            visibility = View.GONE
        }

        try {
            for (item in saved) {
                val old = item.layout
                val adjusted = FrameLayout.LayoutParams(old.width, old.height, old.gravity)
                adjusted.setMargins(
                    old.leftMargin, old.topMargin,
                    old.rightMargin, old.bottomMargin + heightPx
                )
                item.view.layoutParams = adjusted
            }
            content.addView(
                bannerSpace,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, heightPx,
                    Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                )
            )
        } catch (error: RuntimeException) {
            if (bannerSpace.parent === content) content.removeView(bannerSpace)
            for (item in saved) {
                if (item.view.parent === content) item.view.layoutParams = item.layout
            }
            throw error
        }

        contentRoot = content
        container = bannerSpace
        originals = saved
        return bannerSpace
    }

    fun release() {
        check(android.os.Looper.myLooper() == android.os.Looper.getMainLooper())
        val root = contentRoot
        val strip = container
        if (root != null) {
            if (strip?.parent === root) root.removeView(strip)
            // Restore the exact original params, not only width/height.
            for (item in originals) {
                if (item.view.parent === root) item.view.layoutParams = item.layout
            }
        }
        originals = emptyList()
        container = null
        contentRoot = null
    }
}
