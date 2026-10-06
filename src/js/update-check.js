export const UPDATE_API_URL =
  'https://api.github.com/repos/Soldatix/lotto-date-generator-android/releases/latest';

export const UPDATE_DOWNLOAD_URL =
  'https://appsandgames.org/date-lotto-generator';

export function parseVersion(value) {
  const match = String(value ?? '')
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)$/);

  if (!match) return null;

  return match
    .slice(1)
    .map(Number);
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);

  if (!a || !b) {
    throw new Error('Invalid semantic version');
  }

  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }

  return 0;
}

export function createUpdateChecker({
  $,
  currentVersion,
  getText,
  isNative,
  fetchImpl = globalThis.fetch
}) {
  const section = $('updateSection');
  const checkButton = $('checkForUpdates');
  const download = $('downloadUpdate');
  const status = $('updateStatus');

  if (
    !section ||
    !checkButton ||
    !download ||
    !status
  ) {
    return {
      checkForUpdates: async () => {},
      applyLanguage() {}
    };
  }

  const native = Boolean(isNative());
  let state = 'idle';
  let latestVersion = null;

  section.hidden = !native;
  $('settingsUpdateVersion').textContent =
    currentVersion;

  download.href = UPDATE_DOWNLOAD_URL;

  function render() {
    const text = getText();

    $('settingsUpdateTitle').textContent =
      text.title;

    $('settingsUpdateDescription').textContent =
      text.description;

    $('settingsUpdateInstalledLabel').textContent =
      text.installed;

    checkButton.textContent =
      state === 'checking'
        ? text.checking
        : text.check;

    checkButton.disabled =
      state === 'checking';

    download.textContent =
      text.download;

    download.hidden =
      state !== 'available';

    if (state === 'checking') {
      status.textContent = text.checking;
    } else if (state === 'current') {
      status.textContent = text.upToDate;
    } else if (state === 'available') {
      status.textContent =
        text.available.replace(
          '{version}',
          latestVersion
        );
    } else if (state === 'error') {
      status.textContent = text.failed;
    } else {
      status.textContent = '';
    }
  }

  async function checkForUpdates() {
    if (!native || state === 'checking') {
      return;
    }

    state = 'checking';
    render();

    try {
      const response =
        await fetchImpl(
          UPDATE_API_URL,
          {
            method: 'GET',
            headers: {
              Accept: 'application/vnd.github+json'
            },
            cache: 'no-store'
          }
        );

      if (!response?.ok) {
        throw new Error(
          'Update endpoint returned an error'
        );
      }

      const payload =
        await response.json();

      const parsedLatest =
        parseVersion(payload?.tag_name);

      const parsedCurrent =
        parseVersion(currentVersion);

      if (!parsedLatest || !parsedCurrent) {
        throw new Error(
          'Invalid release version'
        );
      }

      latestVersion =
        parsedLatest.join('.');

      state =
        compareVersions(
          latestVersion,
          currentVersion
        ) > 0
          ? 'available'
          : 'current';
    } catch {
      latestVersion = null;
      state = 'error';
    }

    render();
  }

  checkButton.onclick =
    () => void checkForUpdates();

  render();

  return {
    checkForUpdates,
    applyLanguage: render
  };
}
