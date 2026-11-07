import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const s=readFileSync(new URL('../scripts/LevelPlay-Huawei-Tablet-Preview-V8.ps1', import.meta.url),'utf8');

test('V8 tablet verification builds only a disposable SDK-free debug pilot and verifies device',()=>{
  assert.match(s,/WORKSPACE_NOT_DISPOSABLE_TABLET_V8/);
  assert.match(s,/APPROVED_AD_REQUESTS = false/);
  assert.match(s,/SDK_GRADLE_OPT_IN_FORBIDDEN/);
  assert.match(s,/WRONG_TABLET_OR_ARCHITECTURE/);
  assert.match(s,/org\.appsandgames\.datelottogenerator\.levelplaypilot/);
  assert.match(s,/--debug','--apk','--ci','--target','aarch64/);
  assert.match(s,/APK_IDENTITY_AND_NO_AD_GATES=PASS/);
  assert.match(s,/HOST_PROBE=TABLET_PANEL_ATTACHED_NO_ADS/);
  assert.match(s,/PRODUCTION_PACKAGE_STATE_CHANGED/);
  assert.doesNotMatch(s,/\b(?:assembleRelease|installRelease|git\s+reset|git\s+clean|adb\s+uninstall)\b/i);
});


test('Temporary CSS layout proof is syntax valid and never installs or requests ads', () => {
  const url=new URL('../scripts/DateLotto-Tablet-Layout-LiveProof.mjs', import.meta.url);
  const source=readFileSync(url,'utf8');
  const result=spawnSync(process.execPath,['--check',fileURLToPath(url)],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(source,/TEMPORARY_CSS_ONLY=TRUE/);
  assert.match(source,/location\.hostname!=='tauri\.localhost'/);
  assert.match(source,/EXPECTED_VISIBLE_TABLET_TEST_SLOT_MISSING/);
  assert.match(source,/\.resultBox\.tablet-preview-active \.native-tablet-banner-probe/);
  assert.match(source,/AFTER_VISIBLE=/);
  assert.match(source,/VISUAL_PLACEMENT_PASS=/);
  assert.match(source,/forward','--remove'/);
  assert.doesNotMatch(source,/adb\(\[(?:'install'|'uninstall'|'push')/);
  assert.doesNotMatch(source,/LevelPlay\.init|\.loadAd\(/);
});
