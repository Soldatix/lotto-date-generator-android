package org.appsandgames.datelottogenerator

import kotlin.math.roundToInt

/**
 * SDK-free N4 size policy. All values in the anchor and result are
 * root-local physical pixels. N1 has already verified window/IME/inset safety.
 * NEVER scale an SDK creative to make it fit the app's HTML placeholder.
 */
internal data class N4BannerPixelPlacement(
    val leftPx: Int, val topPx: Int, val widthPx: Int, val heightPx: Int
)

internal object N4BannerSizeFitPolicy {
    fun fit(
        anchor: NativeBannerAnchorBounds,
        candidateWidthDp: Int,
        candidateHeightDp: Int,
        density: Float,
        rootWidthPx: Int,
        rootHeightPx: Int
    ): N4BannerPixelPlacement? {
        if (!density.isFinite() || density <= 0f || density > 10f) return null
        if (candidateWidthDp !in 1..2048 || candidateHeightDp !in 1..512) return null
        if (rootWidthPx <= 0 || rootHeightPx <= 0 ||
            anchor.leftPx < 0 || anchor.topPx < 0 ||
            anchor.widthPx <= 0 || anchor.heightPx <= 0) return null

        if (anchor.leftPx.toLong() + anchor.widthPx > rootWidthPx.toLong() ||
            anchor.topPx.toLong() + anchor.heightPx > rootHeightPx.toLong()) return null

        val w = (candidateWidthDp.toDouble() * density.toDouble()).roundToInt()
        val h = (candidateHeightDp.toDouble() * density.toDouble()).roundToInt()
        if (w <= 0 || h <= 0 || w > anchor.widthPx || h > anchor.heightPx) return null

        val x = anchor.leftPx + (anchor.widthPx - w) / 2
        val y = anchor.topPx + (anchor.heightPx - h) / 2
        if (x < 0 || y < 0 ||
            x.toLong() + w > rootWidthPx.toLong() ||
            y.toLong() + h > rootHeightPx.toLong()) return null

        return N4BannerPixelPlacement(x, y, w, h)
    }
}
