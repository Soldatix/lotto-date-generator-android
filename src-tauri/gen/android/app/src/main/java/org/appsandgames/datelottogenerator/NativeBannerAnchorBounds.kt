package org.appsandgames.datelottogenerator

/**
 * No-SDK geometry contract from the reviewed Android native N1 anchor.
 * Values are Android root-local physical pixels, not CSS pixels or dp.
 * They were already checked for the WebView bounds, window visible frame,
 * status/navigation bars, and keyboard by NativeAnchoredBannerProbe.
 *
 * The listener must not infer user consent from a visible rectangle.
 */
internal data class NativeBannerAnchorBounds(
    val leftPx: Int,
    val topPx: Int,
    val widthPx: Int,
    val heightPx: Int
)

internal interface NativeBannerAnchorListener {
    fun onAnchorVisible(bounds: NativeBannerAnchorBounds)
    fun onAnchorHidden()
    fun onAnchorReleased()
}
