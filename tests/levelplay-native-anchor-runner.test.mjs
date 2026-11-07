import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/LevelPlay-Huawei-NativeAnchor-N1.ps1',import.meta.url),'utf8');

test('N1 Huawei only re-launches pinned installed SDK-free pilot with two debug extras',()=>{
  assert.match(script,/WRONG_OR_NONDISPOSABLE_WORKSPACE/);
  assert.match(script,/DEBUG_NATIVE_BANNER_PROBE/);
  assert.match(script,/DEBUG_NATIVE_ANCHORED_PREVIEW/);
  assert.match(script,/APPROVED_AD_REQUESTS = false/);
  assert.match(script,/NATIVE_ANCHOR=ALIGNED_NO_ADS/);
  assert.match(script,/PILOT_APK_AND_NATIVE_ANCHOR=PASS/);
  assert.match(script,/EXPECTED_HUAWEI_CMR_W09_ANDROID_9/);
  assert.match(script,/PRODUCTION_PACKAGE_STATE_CHANGED/);
  assert.doesNotMatch(script,/adb\s+install|install','-r|assembleRelease|git\s+reset|git\s+clean/i);
});
