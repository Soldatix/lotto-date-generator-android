import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const host=read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/NativeBannerHostProbe.kt');
const anchor=read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/NativeAnchoredBannerProbe.kt');
const draft=read('src-tauri/gen/android/app/src/levelplayPilot/java/org/appsandgames/datelottogenerator/LevelPlayNativeBannerPlacementDraft.kt');

test('N5 portrait rail requires a THIRD debug flag while preserving N1/N2 default',()=>{
  assert.match(host,/activity\.packageName != PILOT_PACKAGE/);
  assert.match(host,/ApplicationInfo\.FLAG_DEBUGGABLE/);
  assert.match(host,/getBooleanExtra\(EXTRA_ENABLE, false\)/);
  assert.match(host,/getBooleanExtra\(EXTRA_NATIVE_ANCHOR, false\) == true/);
  assert.match(host,/getBooleanExtra\(EXTRA_N5_PORTRAIT_RAIL, false\) == true/);
  assert.match(host,/DEBUG_N5_PORTRAIT_RAIL/);
  assert.match(host,/replace\("__N5_PORTRAIT_RAIL__", n5Requested\.toString\(\)\)/);
  assert.match(host,/window\.addEventListener\('resize', syncN5\)/);
  assert.match(host,/window\.addEventListener\('orientationchange', syncN5\)/);
  assert.match(host,/slot\.hidden = portrait && grid\.getBoundingClientRect\(\)\.width < 320/);
  assert.match(host,/grid-column:1\/-1/);
  assert.match(anchor,/slot\.parentElement\.matches\('\.grid\.n5-tablet-portrait-rail'\)/);
  assert.match(anchor,/if \(!card && !rail\) return null/);
  assert.doesNotMatch(host,/LevelPlay\.init|\.loadAd\(|setGDPRConsent\(/);
  assert.match(draft,/N3_REAL_BANNER_MOUNT_APPROVED = false/);
  assert.match(draft,/N4_ADAPTIVE_SIZE_NEGOTIATION_APPROVED = false/);
});

test('N5 reuses exactly one previously hidden HTML slot; no advertising SDK calls',()=>{
  const html=read('index.html');
  assert.equal((html.match(/id="nativeTabletBannerProbe"/g)||[]).length,1);
  assert.match(html,/id="nativeTabletBannerProbe"[^>]*hidden/);
  assert.doesNotMatch(host,/com\.unity3d\.mediation|ca-app-pub-|LevelPlaySdkBannerDraft/);
  assert.doesNotMatch(anchor,/com\.unity3d\.mediation|\.loadAd\(/);
});
