/**
 * Message handlers for reading and writing user settings.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { loadSettings, saveSettings } from '../shared/storage.js';

export const messageHandlers = {
  [MESSAGE_TYPES.GET_SETTINGS]: () => loadSettings(),
  [MESSAGE_TYPES.UPDATE_SETTINGS]: async (message) => {
    await saveSettings(message);
    return { success: true };
  },
};
