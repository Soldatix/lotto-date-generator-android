import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const scriptUrl=new URL('../scripts/LevelPlay-Huawei-N2-Targeted.mjs',import.meta.url);
const script=readFileSync(scriptUrl,'utf8');
test('N2-T read-only 3-state verification is syntax-valid and fails closed',()=>{
 const p=spawnSync(process.execPath,['--check',fileURLToPath(scriptUrl)],{encoding:'utf8'});
 assert.equal(p.status,0,p.stderr);
 for(const key of ['HUAWEI_CMR_W09_ANDROID9_REQUIRED','EXACTLY_ONE_AUTHORIZED_DEVICE_REQUIRED',
   'DEBUG_NATIVE_BANNER_PROBE','DEBUG_NATIVE_ANCHORED_PREVIEW','PORTRAIT_CONFIRMED=',
   'OFFSCREEN_CONFIRMED=','KEYBOARD_IME_REPORTED=','OFFSCREEN NOT VERIFIED',
   'NATIVE_ANCHOR=STARTED_NO_ADS','VISUAL_REVIEW_REQUIRED=TRUE',
   'PRODUCTION_PACKAGE_STATE_CHANGED','REAL_ADS=OFF']){
     assert.ok(script.includes(key),key);
 }
 assert.doesNotMatch(script,/(?:assembleDebug|assembleRelease|installDebug|installRelease|LevelPlay\.init|\.loadAd\(|setGDPRConsent)/);
});
