import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const backup = readFileSync('src/js/backup.js', 'utf8');
const bridge = readFileSync('src/js/native-backup.js', 'utf8');
const links = readFileSync('src/js/external-links.js', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
const capability = JSON.parse(
  readFileSync('src-tauri/capabilities/android.json', 'utf8')
);

test('Android backup accepts picker-returned Android content URI locations', () => {
  assert.match(bridge, /await save\(/);
  assert.match(bridge, /await open\(/);
  assert.match(bridge, /writeTextFile\(location, content\)/);
  assert.match(bridge, /readTextFile\(location\)/);

  // Android picker values may be content:// URIs, so never require
  // the selected location itself to end in .json.
  assert.doesNotMatch(
    bridge,
    /\.json\$\/i\.test\(location\)/
  );

  assert.match(backup, /isNativeRuntime\(\)/);
  assert.match(backup, /saveNativeBackup/);
  assert.match(backup, /openNativeBackup/);
  assert.match(main, /return importBackup\(\)/);
});

test('external links use native opener and only approved URLs', () => {
  const expected = [
    'https://appsandgames.org/',
        'https://appsandgames.org/date-lotto-generator',
    'https://www.paypal.com/ncp/payment/RU2CWCNVQ7XD6',
    'https://buy.stripe.com/7sYeVd7Blfe89cm0k02kw00'
  ];

  assert.match(links, /openUrl/);

  for (const url of expected) {
    assert.ok(links.includes(url));
  }

  const opener = capability.permissions.find(
    value =>
      typeof value === 'object' &&
      value.identifier === 'opener:allow-open-url'
  );

  assert.ok(opener);
  assert.deepEqual(
    opener.allow.map(value => value.url),
    expected
  );
});

test('Android capability is narrow', () => {
  assert.deepEqual(capability.platforms, ['android']);

  for (const permission of [
    'core:default',
    'dialog:allow-open',
    'dialog:allow-save',
    'dialog:allow-message',
    'fs:allow-read-text-file',
    'fs:allow-write-text-file'
  ]) {
    assert.ok(capability.permissions.includes(permission));
  }

  assert.equal(
    capability.permissions.some(
      permission =>
        typeof permission === 'string' &&
        /fs:default|fs:read-all|fs:write-all|opener:default/.test(permission)
    ),
    false
  );
});