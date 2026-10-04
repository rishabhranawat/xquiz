/**
 * Message handlers for reading and writing user settings.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { loadSettings, migrateStoredSettings, saveSettings } from '../shared/storage.js';

/**
 * Upgrades legacy synced settings when the extension is installed or updated.
 * Call synchronously at service worker start (MV3 listener rule). Reads also
 * migrate in memory, so a failure here loses nothing.
 */
export function registerSettingsMigration() {
  chrome.runtime.onInstalled?.addListener(() => {
    migrateStoredSettings().catch((error) => {
      logger.warn('Settings migration failed:', error.message);
    });
  });
}

export const messageHandlers = {
  [MESSAGE_TYPES.GET_SETTINGS]: () => loadSettings(),
  [MESSAGE_TYPES.UPDATE_SETTINGS]: async (message) => {
    await saveSettings(message);
    return { success: true };
  },
};
