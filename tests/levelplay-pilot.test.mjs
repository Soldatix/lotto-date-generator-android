import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const js = read('src/js/levelplay-pilot.js');
const html = read('index.html');
const css = read('src/styles/main.css');
const main = read('src/main.js');
const gradle = read('src-tauri/gen/android/app/build.gradle.kts');
const activity = read('src-tauri/gen/android/app/src/main/java/org/appsandgames/datelottogenerator/MainActivity.kt');

test('Android Tauri only, explicit preview parameter, no default ad placement', () => {
  assert.match(js, /params\.get\('levelPlayPreview'\) !== '1'/);
  assert.match(js, /!isTauri \|\| !isAndroid/);
  assert.match(js, /__TAURI_INTERNALS__/);
  assert.match(js, /Android\/i/);
  assert.match(html, /id="levelPlayPilot"[^>]*hidden/);
  assert.match(css, /\.levelplay-pilot\[hidden\] \{ display: none !important; \}/);
  assert.match(main, /initializeLevelPlayPreview\(\)/);
  assert.equal((html.match(/id="levelPlayPilot"/g) || []).length, 1);
});

test('No network ad SDK, web banner or tracking added to the application', () => {
  assert.doesNotMatch(js, /fetch\s*\(|XMLHttpRequest|createElement\(['"]script|bauval|atOptions|adsbygoogle|document\.write/i);
  assert.doesNotMatch(main, /LevelPlay\.init|LevelPlay\.Init|mediation-sdk|IronSource\.init/);
  assert.match(gradle, /if \(levelPlaySdkPilot\) \{\s*implementation\("com\\.unity3d\\.ads-mediation:mediation-sdk:9\\.5\\.0"\)/);
  assert.doesNotMatch(activity, /LevelPlay|IronSource|adUnitId/);
});

test('Mock banner is outside both generator cards and only 320x50', () => {
  const gridEnd = html.indexOf('  </div>\n  <!-- Android/Tauri LevelPlay');
  const region = html.indexOf('id="levelPlayPilot"');
  const footer = html.indexOf('class="footer"');
  assert.ok(gridEnd >= 0 && region > gridEnd && footer > region);
  assert.match(css, /width: min\(320px, 100%\); min-height: 50px/);
  assert.match(js, /win\.innerWidth >= 320/);
  assert.match(js, /let choice = null/);
  assert.doesNotMatch(js, /localStorage|sessionStorage/);
});

test('Mock choices and all portal languages available', () => {
  for (const code of ['en','hr','de','it','es'])
    assert.match(js, new RegExp('\\b' + code + ': \\{'));
  assert.match(js, /button\(l.reject,/);
  assert.match(js, /button\(l.allow,/);
  assert.match(js, /l\.change/);
  assert.match(js, /languageSelect\?\.addEventListener\('change', render\)/);
});