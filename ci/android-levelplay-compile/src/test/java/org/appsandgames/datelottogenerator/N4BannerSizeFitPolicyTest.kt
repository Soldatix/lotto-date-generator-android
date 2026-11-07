package org.appsandgames.datelottogenerator

import org.junit.Assert.*
import org.junit.Test

/** Pure JVM tests: no APK, no ads, no SDK startup, no Android device. */
class N4BannerSizeFitPolicyTest {
    private fun anchor(w: Int, h: Int = 125) =
        NativeBannerAnchorBounds(1540, 1100, w, h)

    @Test fun standardLandscape320By50Fits() {
        val p = N4BannerSizeFitPolicy.fit(anchor(800), 320, 50, 2.5f, 2560, 1600)
        assertNotNull(p)
        assertEquals(1540,p!!.leftPx)
        assertEquals(1100,p.topPx)
        assertEquals(800,p.widthPx)
        assertEquals(125,p.heightPx)
    }
    @Test fun portrait298DpRejects320Dp() {
        assertNull(N4BannerSizeFitPolicy.fit(
            NativeBannerAnchorBounds(750,1900,745,125),320,50,2.5f,1600,2560))
    }
    @Test fun deviceWide728By90AdaptiveDoesNotFitRightPanel() {
        assertNull(N4BannerSizeFitPolicy.fit(anchor(800),728,90,2.5f,2560,1600))
    }
    @Test fun smallerCandidateCentersWithoutScaling() {
        val p=N4BannerSizeFitPolicy.fit(anchor(800),300,45,2.5f,2560,1600)
        assertNotNull(p)
        assertEquals(1565,p!!.leftPx)
        assertEquals(1106,p.topPx)
        assertEquals(750,p.widthPx)
        assertEquals(113,p.heightPx)
    }
    @Test fun overflowOrOutsideRootRejected() {
        assertNull(N4BannerSizeFitPolicy.fit(
            NativeBannerAnchorBounds(1540,1490,800,125),320,50,2.5f,2560,1600))
        assertNull(N4BannerSizeFitPolicy.fit(
            NativeBannerAnchorBounds(-1,1100,800,125),320,50,2.5f,2560,1600))
    }
    @Test fun invalidSizeOrDensityRejected() {
        assertNull(N4BannerSizeFitPolicy.fit(anchor(800),0,50,2.5f,2560,1600))
        assertNull(N4BannerSizeFitPolicy.fit(anchor(800),320,0,2.5f,2560,1600))
        assertNull(N4BannerSizeFitPolicy.fit(anchor(800),320,50,Float.NaN,2560,1600))
        assertNull(N4BannerSizeFitPolicy.fit(anchor(800),320,50,Float.POSITIVE_INFINITY,2560,1600))
    }
    @Test fun cmpEvenWithSyntheticPositiveEvidenceCannotPermitSdk() {
        val positive=N4CmpEvidence(N4CmpOutcome.READY_AS_REPORTED_BY_CMP,
            true,true,true,true,true,true)
        assertTrue(N4ConsentGateDraft.evidenceReadyForFutureReview(positive))
        assertFalse(N4ConsentGateDraft.sdkInitializationPermitted(positive))
        assertFalse(N4ConsentGateDraft.sdkInitializationPermitted(N4CmpEvidence()))
        assertFalse(N4ConsentGateDraft.sdkInitializationPermitted(
            positive.copy(outcome=N4CmpOutcome.WITHDRAWN)))
    }
}
