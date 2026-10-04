/**
 * Persisted reading log (what the user dwelled on, per local day) and the
 * message handlers that feed it. Data never leaves the browser from here.
 */

import { MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { localDayKey } from '../shared/day.js';
import { loadSettings } from '../shared/storage.js';
import { addBatchToLog, normalizeLog, summarizeDay } from './reading-log.js';
import { createStore } from './store.js';

export const readingStore = createStore(STORAGE_KEYS.READING_LOG, () => ({}), normalizeLog);

/**
 * Posts tracked for a day.
 * @param {string} day
 * @returns {Promise<object[]>}
 */
export async function getDayPosts(day) {
  const log = await readingStore.get();
  return Object.values(log[day] ?? {});
}

export const messageHandlers = {
  [MESSAGE_TYPES.READING_BATCH]: async (message) => {
    // Defence in depth: a stale content script must not record after opt-out.
    const { digestEnabled, digestPaused } = await loadSettings();
    if (!digestEnabled || digestPaused) return { success: false, tracking: false };

    const now = Date.now();
    await readingStore.update((log) => addBatchToLog(log, message.posts, localDayKey(now), now));
    return { success: true, tracking: true };
  },

  [MESSAGE_TYPES.GET_READING_STATUS]: async () => {
    const log = await readingStore.get();
    return { today: summarizeDay(log[localDayKey()]) };
  },
};
