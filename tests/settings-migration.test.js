// Storage-level migration of the legacy `removeVideos` setting, against an
// in-memory fake of chrome.storage.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

let sync;
let local;

const area = (data) => ({
  get: async (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(list.filter((k) => k in data).map((k) => [k, data[k]]));
  },
  set: async (items) => Object.assign(data, structuredClone(items)),
  remove: async (keys) => [].concat(keys).forEach((k) => delete data[k]),
});

beforeEach(() => {
  sync = {};
  local = {};
  globalThis.chrome = { storage: { sync: area(sync), local: area(local) } };
});

const storage = () => import('../src/shared/storage.js');

test('migrateStoredSettings rewrites removeVideos:true and deletes the legacy key', async () => {
  Object.assign(sync, { removeVideos: true, tweetsPerQuiz: 7 });
  const { migrateStoredSettings } = await storage();
  await migrateStoredSettings();
  assert.deepEqual(sync, {
    tweetsPerQuiz: 7,
    distractionMode: true,
    hideVideos: true,
    hideImageOnly: false,
  });
});

test('migrateStoredSettings with removeVideos:false just drops the key', async () => {
  Object.assign(sync, { removeVideos: false, viewTimeMs: 3000 });
  const { migrateStoredSettings } = await storage();
  await migrateStoredSettings();
  assert.deepEqual(sync, { viewTimeMs: 3000 });
});

test('migrateStoredSettings is a no-op without legacy keys and keeps newer values', async () => {
  Object.assign(sync, { distractionMode: false, hideVideos: false });
  const { migrateStoredSettings } = await storage();
  await migrateStoredSettings();
  assert.deepEqual(sync, { distractionMode: false, hideVideos: false });

  Object.assign(sync, { removeVideos: true });
  await migrateStoredSettings();
  assert.deepEqual(sync, { distractionMode: false, hideVideos: false });
});

test('reads migrate in memory even before the stored migration ran', async () => {
  Object.assign(sync, { removeVideos: true });
  const { loadSettings, loadSyncedSettings } = await storage();
  for (const settings of [await loadSettings(), await loadSyncedSettings()]) {
    assert.equal(settings.distractionMode, true);
    assert.equal(settings.hideVideos, true);
    assert.equal(settings.hideImageOnly, false);
  }
  assert.equal(sync.removeVideos, true, 'reading does not write');
});

test('saveSettings removes the legacy key', async () => {
  Object.assign(sync, { removeVideos: true });
  const { saveSettings } = await storage();
  await saveSettings({ distractionMode: true, hideVideos: false, hideImageOnly: true });
  assert.equal('removeVideos' in sync, false);
  assert.equal(sync.hideVideos, false);
});
