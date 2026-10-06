import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const gradle =
  readFileSync(
    'src-tauri/gen/android/app/build.gradle.kts',
    'utf8'
  );

const ignore =
  readFileSync(
    'src-tauri/gen/android/.gitignore',
    'utf8'
  );

test('release signing uses local ignored properties', () => {
  assert.match(
    gradle,
    /DATE_LOTTO_RELEASE_SIGNING/
  );

  assert.match(
    gradle,
    /rootProject\.file\("keystore\.properties"\)/
  );

  assert.match(
    gradle,
    /create\("release"\)/
  );

  assert.match(
    gradle,
    /signingConfigs\.getByName\("release"\)/
  );

  assert.match(
    ignore,
    /^keystore\.properties$/m
  );
});

test('tracked signing configuration contains no literal password', () => {
  assert.doesNotMatch(
    gradle,
    /storePassword\s*=\s*"[^"]+"/
  );

  assert.doesNotMatch(
    gradle,
    /keyPassword\s*=\s*"[^"]+"/
  );

  assert.match(
    gradle,
    /keyPassword\s*=\s*\r?\n\s*keystoreProperties\.getProperty\("password"\)/
  );

  assert.match(
    gradle,
    /storePassword\s*=\s*\r?\n\s*keystoreProperties\.getProperty\("password"\)/
  );

  assert.doesNotMatch(
    gradle,
    /AndroidSigningKeys|date-lotto-generator-release\.jks/
  );
});
