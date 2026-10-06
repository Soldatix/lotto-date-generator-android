import { open, save, confirm } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

const jsonFilter = [{ name: 'JSON', extensions: ['json'] }];

const validPickedLocation = value =>
  typeof value === 'string' && value.trim().length > 0;

export function confirmNativeAction(message) {
  return confirm(message, {
    title: 'Date Lotto Generator',
    kind: 'warning'
  });
}

export async function saveNativeBackup(content, defaultName, title) {
  const location = await save({
    title,
    defaultPath: defaultName,
    filters: jsonFilter
  });

  if (location === null) return null;

  // Android returns content:// URIs rather than normal filesystem paths.
  // The Tauri filesystem plugin supports picker-returned locations directly.
  if (!validPickedLocation(location)) {
    throw new Error('invalid backup location');
  }

  await writeTextFile(location, content);
  return location;
}

export async function openNativeBackup(lastLocation, title) {
  const reusableDefault =
    lastLocation &&
    !/^content:\/\//i.test(lastLocation)
      ? { defaultPath: lastLocation }
      : {};

  const location = await open({
    title,
    ...reusableDefault,
    multiple: false,
    directory: false,
    filters: jsonFilter
  });

  if (location === null) return null;

  if (!validPickedLocation(location)) {
    throw new Error('invalid backup location');
  }

  return {
    path: location,
    text: await readTextFile(location)
  };
}