import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/LevelPlay-Huawei-NativeAnchor-N2-StateMatrix.ps1',import.meta.url),'utf8');
test('N2 collects portrait, landscape, scroll, IME and app-restore evidence without ads',()=>{
  for(const token of ['HUAWEI_CMR_W09_EXPECTED','NATIVE_ANCHOR_NOT_STARTED_IN_CURRENT_PROCESS',
     '01-landscape-top','02-portrait','03-landscape-scrolled','04-keyboard-open',
     '05-background-return','PRODUCTION_PACKAGE_STATE_CHANGED','Export-Csv -LiteralPath']){
    assert.ok(script.includes(token),token);
  }
  assert.doesNotMatch(script,/(?:adb\s+install|adb\s+uninstall|force-stop|logcat.*'-c'|assembleRelease|tauri\s+android\s+build)/i);
});
