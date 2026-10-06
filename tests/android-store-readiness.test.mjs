import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(path, 'utf8');

const manifest =
  read('src-tauri/gen/android/app/src/main/AndroidManifest.xml');

const gradle =
  read('src-tauri/gen/android/app/build.gradle.kts');

const tauri =
  JSON.parse(read('src-tauri/tauri.conf.json'));

const pkg =
  JSON.parse(read('package.json'));

test('Android Store build is phone/tablet only', () => {
  assert.equal(manifest.includes('LEANBACK_LAUNCHER'), false);
  assert.equal(manifest.includes('android.software.leanback'), false);
  assert.equal(
    manifest.includes('android.intent.category.LAUNCHER'),
    true
  );
});

test('Android SDK baseline remains API 37 / minSdk 24', () => {
  assert.match(gradle, /compileSdk\s*=\s*37/);
  assert.match(gradle, /targetSdk\s*=\s*37/);
  assert.match(gradle, /minSdk\s*=\s*24/);
});

test('Android package identity and v1.0.1 version remain stable', () => {
  assert.equal(
    tauri.identifier,
    'org.appsandgames.datelottogenerator'
  );
  assert.equal(tauri.version, '1.0.1');
  assert.equal(tauri.bundle.android.minSdkVersion, 24);
});

test('package metadata points to dedicated Android repository', () => {
  assert.equal(
    pkg.repository.url,
    'git+https://github.com/Soldatix/lotto-date-generator-android.git'
  );
  assert.equal(
    pkg.bugs.url,
    'https://github.com/Soldatix/lotto-date-generator-android/issues'
  );
});
