import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Tauri and Android Studio reserve a separate package ID for debug pilot', () => {
  const config = JSON.parse(read('src-tauri/tauri.conf.json'));
  const gradle = read('src-tauri/gen/android/app/build.gradle.kts');
  const mainLabel = read('src-tauri/gen/android/app/src/main/res/values/strings.xml');
  const testLabel = read('src-tauri/gen/android/app/src/debug/res/values/strings.xml');
  assert.equal(config.identifier, 'org.appsandgames.datelottogenerator');
  assert.equal(config.bundle.android.debugApplicationIdSuffix, '.levelplaypilot');
  assert.match(gradle, /applicationId = "org\.appsandgames\.datelottogenerator"/);
  assert.match(gradle, /getByName\("debug"\) \{\s*\/\/[\s\S]+?applicationIdSuffix = "\.levelplaypilot"/);
  assert.match(testLabel, /Date Lotto - LP TEST/);
  assert.match(mainLabel, /Date Lotto Generator/);
  assert.doesNotMatch(mainLabel,/LevelPlayTest|LP TEST/);
});

test('Local APK build enforces unique actual package ID and never installs it', () => {
  const s = read('scripts/LevelPlay-Android-Safe-DebugBuild.ps1');
  assert.match(s, /expectedId = 'org\.appsandgames\.datelottogenerator\.levelplaypilot'/);
  assert.match(s, /PRODUCTION_NO_GO=TRUE; RELEASE_BUILD=FORBIDDEN; APK_INSTALL=FORBIDDEN; ADS=OFF/);
  assert.match(s, /OPTIONAL_AD_SDK_DISABLED=TRUE/);
  assert.match(s, /GRADLE_USER_HOME/);
  assert.match(s, /NDK_HOME_FOR_THIS_RUN=/);
  assert.match(s, /\$env:NDK_HOME = \$ndkHome/);
  assert.match(s, /\$env:NDK_HOME = \$oldNdk/);
  assert.match(s, /TAURI_MODIFIED_TRACKED_SOURCE_REVIEW_REQUIRED/);
  assert.match(s, /APPROVED_AD_REQUESTS = false/);
  assert.match(s, /Start-Process -FilePath \$npmExecutable -ArgumentList/);
  assert.match(s, /'ci', '--no-audit', '--no-fund'/);
  assert.match(s, /'--debug', '--apk', '--ci', '--target', 'aarch64'/);
  assert.match(s, /TAURI_DEBUG_BUILD_FAILED_EXIT=/);
  assert.match(s, /dump badging \$candidate\.FullName/);
  assert.match(s, /if \(\$actualId -ne \$expectedId\)/);
  assert.match(s, /DEBUG_APK_LABEL_NOT_VERIFIED/);
  assert.match(s, /APK_NOT_INSTALLED=TRUE; PRODUCTION_NO_GO=TRUE/);
  assert.doesNotMatch(s, /\badb\s+(?:install|uninstall|shell)\b/i);
  assert.doesNotMatch(s, /(?:--release|assembleRelease|installDebug|installRelease)/);
  assert.doesNotMatch(s, /Remove-Item|rm\s+-rf|git\s+(?:reset|clean)/i);
});
