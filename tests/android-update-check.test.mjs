import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const load = source =>
  import(
    'data:text/javascript;base64,' +
    Buffer.from(source).toString('base64')
  );

const {
  UPDATE_API_URL,
  UPDATE_DOWNLOAD_URL,
  parseVersion,
  compareVersions,
  createUpdateChecker
} = await load(
  readFileSync(
    'src/js/update-check.js',
    'utf8'
  )
);

const { UPDATE_T } = await load(
  readFileSync(
    'src/data/translations.js',
    'utf8'
  )
);

const texts = {
  title: 'Updates',
  description: 'Check for a newer version.',
  installed: 'Installed version',
  check: 'Check for updates',
  checking: 'Checking…',
  upToDate: 'Latest version.',
  available: 'Version {version} is available.',
  download: 'Download update',
  failed: 'Update check failed.'
};

function fixture({
  native = true,
  tag = 'v1.0.1',
  ok = true
} = {}) {
  const ids = [
    'updateSection',
    'checkForUpdates',
    'downloadUpdate',
    'updateStatus',
    'settingsUpdateTitle',
    'settingsUpdateDescription',
    'settingsUpdateInstalledLabel',
    'settingsUpdateVersion'
  ];

  const elements =
    Object.fromEntries(
      ids.map(id => [
        id,
        {
          hidden: false,
          disabled: false,
          textContent: '',
          href: '',
          onclick: null
        }
      ])
    );

  let calls = 0;

  const checker =
    createUpdateChecker({
      $: id => elements[id],
      currentVersion: '1.0.1',
      getText: () => texts,
      isNative: () => native,
      fetchImpl: async url => {
        calls++;

        assert.equal(
          url,
          UPDATE_API_URL
        );

        return {
          ok,
          async json() {
            return {
              tag_name: tag
            };
          }
        };
      }
    });

  return {
    elements,
    checker,
    get calls() {
      return calls;
    }
  };
}

test('semantic version comparison is strict', () => {
  assert.deepEqual(
    parseVersion('v1.0.1'),
    [1, 0, 1]
  );

  assert.equal(
    compareVersions('1.0.2', '1.0.1'),
    1
  );

  assert.equal(
    compareVersions('1.0.1', '1.0.1'),
    0
  );

  assert.equal(
    compareVersions('1.0.0', '1.0.1'),
    -1
  );

  assert.equal(
    parseVersion('latest'),
    null
  );
});

test('native checker reports newer public release', async () => {
  const f =
    fixture({
      tag: 'v1.0.2'
    });

  assert.equal(
    f.elements.updateSection.hidden,
    false
  );

  await f.checker.checkForUpdates();

  assert.equal(f.calls, 1);

  assert.equal(
    f.elements.updateStatus.textContent,
    'Version 1.0.2 is available.'
  );

  assert.equal(
    f.elements.downloadUpdate.hidden,
    false
  );

  assert.equal(
    f.elements.downloadUpdate.href,
    UPDATE_DOWNLOAD_URL
  );
});

test('same or older release reports current', async () => {
  for (const tag of [
    'v1.0.1',
    'v1.0.0'
  ]) {
    const f = fixture({ tag });

    await f.checker.checkForUpdates();

    assert.equal(
      f.elements.updateStatus.textContent,
      'Latest version.'
    );

    assert.equal(
      f.elements.downloadUpdate.hidden,
      true
    );
  }
});

test('network and malformed release failures are contained', async () => {
  const failed =
    fixture({
      ok: false
    });

  await failed.checker.checkForUpdates();

  assert.equal(
    failed.elements.updateStatus.textContent,
    'Update check failed.'
  );

  const malformed =
    fixture({
      tag: 'latest'
    });

  await malformed.checker.checkForUpdates();

  assert.equal(
    malformed.elements.updateStatus.textContent,
    'Update check failed.'
  );
});

test('update UI is hidden outside native runtime', async () => {
  const f =
    fixture({
      native: false,
      tag: 'v9.9.9'
    });

  assert.equal(
    f.elements.updateSection.hidden,
    true
  );

  await f.checker.checkForUpdates();

  assert.equal(f.calls, 0);
});

test('all five update translations are complete', () => {
  const languages = [
    'en',
    'hr',
    'de',
    'it',
    'es'
  ];

  const keys =
    Object.keys(UPDATE_T.en);

  for (const lang of languages) {
    for (const key of keys) {
      assert.ok(
        UPDATE_T[lang][key]?.trim(),
        `${lang}.${key}`
      );
    }
  }
});

test('endpoint, CSP and download destination are narrow', () => {
  assert.equal(
    UPDATE_API_URL,
    'https://api.github.com/repos/Soldatix/lotto-date-generator-android/releases/latest'
  );

  assert.equal(
    UPDATE_DOWNLOAD_URL,
    'https://appsandgames.org/date-lotto-generator'
  );

  const tauri =
    JSON.parse(
      readFileSync(
        'src-tauri/tauri.conf.json',
        'utf8'
      )
    );

  assert.match(
    tauri.app.security.csp['connect-src'],
    /https:\/\/api\.github\.com/
  );

  const capability =
    JSON.parse(
      readFileSync(
        'src-tauri/capabilities/android.json',
        'utf8'
      )
    );

  const opener =
    capability.permissions.find(
      item =>
        typeof item === 'object' &&
        item.identifier ===
          'opener:allow-open-url'
    );

  assert.ok(
    opener.allow.some(
      item =>
        item.url ===
        'https://appsandgames.org/date-lotto-generator'
    )
  );
});

test('tracked version sources are v1.0.1 and derive Android versionCode 1000001', () => {
  const pkg =
    JSON.parse(
      readFileSync(
        'package.json',
        'utf8'
      )
    );

  const lock =
    JSON.parse(
      readFileSync(
        'package-lock.json',
        'utf8'
      )
    );

  const tauri =
    JSON.parse(
      readFileSync(
        'src-tauri/tauri.conf.json',
        'utf8'
      )
    );

  const cargo =
    readFileSync(
      'src-tauri/Cargo.toml',
      'utf8'
    );

  const cargoLock =
    readFileSync(
      'src-tauri/Cargo.lock',
      'utf8'
    );

  assert.equal(pkg.version, '1.0.1');
  assert.equal(lock.version, '1.0.1');
  assert.equal(
    lock.packages[''].version,
    '1.0.1'
  );
  assert.equal(tauri.version, '1.0.1');

  const [major, minor, patch] =
    tauri.version
      .split('.')
      .map(Number);

  assert.equal(
    major * 1000000 +
      minor * 1000 +
      patch,
    1000001
  );

  assert.match(
    cargo,
    /\[package\][\s\S]*?version\s*=\s*"1\.0\.1"/
  );

  assert.match(
    cargoLock,
    /\[\[package\]\]\s+name = "date-lotto-generator"\s+version = "1\.0\.1"/
  );
});
