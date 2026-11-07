import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const script=readFileSync(new URL("../scripts/LevelPlay-Huawei-N7-UMP-FormOnly.ps1",import.meta.url),"utf8");
const src=readFileSync(new URL("../src-tauri/gen/android/app/src/n7ConsentPilot/java/org/appsandgames/datelottogenerator/N7UmpPreviewActivity.kt",import.meta.url),"utf8");
test("N7 device script checks exact Huawei test package and no ads",()=>{
 for(const s of [
 "DateLotto-N7-","CMR-W09","'28'","org.appsandgames.datelottogenerator.levelplaypilot",
 "SOURCE_GATES=PASS","N7_UMP_ONLY","N7_PRODUCTION_NO_GO","APPROVED_AD_REQUESTS = false",
 "ORG_GRADLE_PROJECT_appsGamesN7UmpPreview='true'",
 "N7UmpPreviewActivity","N7_ONLY_DEX_GATE_FAILED","LEVELPLAY_SDK=ABSENT",
 "PRODUCTION_PACKAGE_STATE=UNCHANGED","APPROVE N7 UMP", "PRODUCTION_NO_GO=TRUE"
 ])assert.ok(script.includes(s),s);
 assert.doesNotMatch(script,/adb\s+uninstall|--release|publishToPlay|bundleRelease|signingConfig\s*=/i);
 assert.match(script,/if\(-not \$InstallAndLaunch\)/);
 assert.match(src,/DEBUG_N7_UMP_PREVIEW/);
});
test("N7 uses local-only private Android AdMob app ID and never prints it",()=>{
 assert.match(script,/Read-Host [^\n]*-AsSecureString/);
 assert.match(script,/APPSGAMES_N7_ADMOB_APP_ID=\$privateAppId/);
 assert.match(script,/ID_NOT_PRINTED=TRUE/);
 assert.match(script,/Get-FileHash/);
 assert.doesNotMatch(script,/294760d25|vu3eqmvs1u5vo6wi|3903782993/);
});
