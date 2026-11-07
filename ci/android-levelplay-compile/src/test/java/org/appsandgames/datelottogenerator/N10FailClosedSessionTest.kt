package org.appsandgames.datelottogenerator

import org.junit.Assert.*
import org.junit.Test

/** JVM only; no UMP network, Unity SDK init, APK, ad ID or Android device. */
class N10FailClosedSessionTest {
    private val goodAnchor = NativeBannerAnchorBounds(100, 100, 800, 125)
    private fun showNoAdCandidate(s: N10FailClosedSession) =
        s.updateN5Anchor(goodAnchor, 2.5f, 1920, 1200)

    @Test fun reportsUmpReadinessButNeverGrantsSdkOrAdRequests() {
        val s = N10FailClosedSession()
        val g = s.beginRefresh()!!
        assertFalse(s.snapshot().sdkInitializationAllowed)
        assertFalse(s.snapshot().testAdRequestAllowed)
        assertTrue(s.refreshed(g, umpReady = true, privacyRequired = true))
        assertTrue(s.completedConsentForm(g, success = true))
        val diagnostic = s.snapshot()
        assertEquals(N10Phase.REVIEW_ONLY, diagnostic.phase)
        assertTrue(diagnostic.umpCanRequestAdsReported)
        assertTrue(diagnostic.privacyOptionsRequired)
        assertNotNull(showNoAdCandidate(s))
        assertFalse(s.snapshot().sdkInitializationAllowed)
        assertFalse(s.snapshot().testAdRequestAllowed)
    }

    @Test fun rejectionAfterPrivacyFormAlwaysRevokesN5Candidate() {
        val s = N10FailClosedSession()
        val g = s.beginRefresh()!!
        assertTrue(s.refreshed(g, true, true))
        assertTrue(s.completedConsentForm(g, true))
        assertNotNull(showNoAdCandidate(s))
        val privacyGeneration = s.beginPrivacyOptionsFromUserAction()!!
        assertNull(s.snapshot().n5Fit)
        assertTrue(s.privacyOptionsClosed(privacyGeneration, success = true))
        assertEquals(N10Phase.WITHDRAWN, s.snapshot().phase)
        assertNull(showNoAdCandidate(s))
        assertFalse(s.snapshot().testAdRequestAllowed)
        assertFalse(s.snapshot().sdkInitializationAllowed)
    }

    @Test fun delayedCallbacksCannotResurrectConsentAfterWithdrawal() {
        val s = N10FailClosedSession()
        val first = s.beginRefresh()!!
        assertTrue(s.refreshed(first, true, true))
        s.withdrawn()
        assertFalse(s.completedConsentForm(first, success = true))
        assertNull(s.snapshot().n5Fit)
        assertEquals(N10Phase.WITHDRAWN, s.snapshot().phase)
        assertFalse(s.snapshot().umpCanRequestAdsReported)
        assertFalse(s.snapshot().testAdRequestAllowed)
    }

    @Test fun errorsAndReentrantRequestsRemainFailClosed() {
        val s = N10FailClosedSession()
        val g = s.beginRefresh()!!
        assertNull(s.beginRefresh())
        assertTrue(s.refreshed(g, true, false))
        assertNull(s.beginPrivacyOptionsFromUserAction())
        assertTrue(s.completedConsentForm(g, success = false))
        assertEquals(N10Phase.FAILED, s.snapshot().phase)
        assertNull(showNoAdCandidate(s))
        assertFalse(s.snapshot().testAdRequestAllowed)
    }

    @Test fun pauseOffscreenAndInvalidSizeHidePlacement() {
        val s = N10FailClosedSession()
        val g = s.beginRefresh()!!
        assertTrue(s.refreshed(g, true, true))
        assertTrue(s.completedConsentForm(g, true))
        assertNotNull(showNoAdCandidate(s))
        s.pause()
        assertNull(s.snapshot().n5Fit)
        assertNull(showNoAdCandidate(s))
        s.resume()
        assertNull(s.updateN5Anchor(
            NativeBannerAnchorBounds(100, 100, 600, 125),
            2.5f, 1920, 1200
        ))
        assertNotNull(showNoAdCandidate(s))
        s.anchorHidden()
        assertNull(s.snapshot().n5Fit)
    }

    @Test fun destroyBlocksStaleRequestsAndNeverRestartsAds() {
        val s = N10FailClosedSession()
        val g = s.beginRefresh()!!
        s.close()
        assertNull(s.beginRefresh())
        assertFalse(s.refreshed(g, true, true))
        assertNull(showNoAdCandidate(s))
        assertEquals(N10Phase.CLOSED, s.snapshot().phase)
        assertFalse(s.snapshot().sdkInitializationAllowed)
        assertFalse(s.snapshot().testAdRequestAllowed)
    }
}
