/**
 * Promise-based wrappers over chrome.storage and the settings persistence
 * layout: the API key stays in storage.local (never synced); every other
 * setting is synced. Safe to import anywhere; chrome is only touched when a
 * function is called.
 */

import { DEFAULT_SETTINGS, SYNC_SETTING_KEYS } from './constants.js';
import { normalizeSettings } from './settings.js';

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
  const synced = await chrome.storage.sync.get(SYNC_SETTING_KEYS);
  return normalizeSettings(synced);
}

/**
 * Reads all settings (synced values plus the local API key), normalized.
 * @returns {Promise<ReturnType<typeof normalizeSettings>>}
 */
export async function loadSettings() {
  const [synced, local] = await Promise.all([
    chrome.storage.sync.get(SYNC_SETTING_KEYS),
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
