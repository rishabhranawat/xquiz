/**
 * Promise-based wrappers over chrome.storage and the settings persistence
 * layout: the API key stays in storage.local (never synced); every other
 * setting is synced. Safe to import anywhere; chrome is only touched when a
 * function is called.
 */

import { DEFAULT_SETTINGS, LEGACY_SYNC_SETTING_KEYS, SYNC_SETTING_KEYS } from './constants.js';
import { migrateLegacySettings, normalizeSettings } from './settings.js';

/** Current plus legacy keys; legacy values are migrated by normalizeSettings. */
const READ_SYNC_KEYS = [...SYNC_SETTING_KEYS, ...LEGACY_SYNC_SETTING_KEYS];

/**
 * @param {string | string[]} keys
 * @returns {Promise<Record<string, any>>}
 */
export const getLocal = (keys) => chrome.storage.local.get(keys);

/** @param {Record<string, any>} items */
export const setLocal = (items) => chrome.storage.local.set(items);

/**
 * Reads only the synced (non-secret) settings, normalized. Safe to call from
 * content scripts, which never need the API key.
 * @returns {Promise<ReturnType<typeof normalizeSettings>>}
 */
export async function loadSyncedSettings() {
  const synced = await chrome.storage.sync.get(READ_SYNC_KEYS);
  return normalizeSettings(synced);
}

/**
 * Reads all settings (synced values plus the local API key), normalized.
 * @returns {Promise<ReturnType<typeof normalizeSettings>>}
 */
export async function loadSettings() {
  const [synced, local] = await Promise.all([
    chrome.storage.sync.get(READ_SYNC_KEYS),
    getLocal('apiKey'),
  ]);
  return normalizeSettings({ ...synced, apiKey: local.apiKey ?? DEFAULT_SETTINGS.apiKey });
}

/**
 * Normalizes and persists settings; returns what was stored.
 * @param {Partial<typeof DEFAULT_SETTINGS>} raw
 */
export async function saveSettings(raw) {
  const { apiKey, ...synced } = normalizeSettings(raw);
  await setLocal({ apiKey });
  await chrome.storage.sync.set(synced);
  await chrome.storage.sync.remove(LEGACY_SYNC_SETTING_KEYS);
  return { apiKey, ...synced };
}

/**
 * Calls `callback` with the normalized synced settings whenever any of them
 * change (in any extension context).
 * @param {(settings: ReturnType<typeof normalizeSettings>) => void} callback
 */
export function onSyncedSettingsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !SYNC_SETTING_KEYS.some((key) => key in changes)) return;
    loadSyncedSettings().then(callback);
  });
}

/**
 * One-off storage upgrade: rewrites legacy synced settings into their current
 * shape and deletes the legacy keys. Safe to call repeatedly (a no-op once
 * migrated). Reads also migrate in memory, so nothing depends on this having
 * run.
 */
export async function migrateStoredSettings() {
  const stored = await chrome.storage.sync.get(LEGACY_SYNC_SETTING_KEYS);
  if (!LEGACY_SYNC_SETTING_KEYS.some((key) => key in stored)) return;
  const current = await chrome.storage.sync.get(SYNC_SETTING_KEYS);
  const { distractionMode, hideVideos, hideImageOnly } = migrateLegacySettings({
    ...current,
    ...stored,
  });
  await chrome.storage.sync.set(
    Object.fromEntries(
      Object.entries({ distractionMode, hideVideos, hideImageOnly }).filter(
        ([, value]) => value !== undefined
      )
    )
  );
  await chrome.storage.sync.remove(LEGACY_SYNC_SETTING_KEYS);
}
