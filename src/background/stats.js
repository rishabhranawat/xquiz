/**
 * Persisted quiz statistics (score, streaks). Pure logic is in shared/stats.js.
 */

import { MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { createEmptyStats, normalizeStats, recordAnswer } from '../shared/stats.js';
import { createStore } from './store.js';

const statsStore = createStore(STORAGE_KEYS.STATS, createEmptyStats, normalizeStats);

/** Returns the current stats. */
export const getStats = () => statsStore.get();

/**
 * Records an answer and returns the updated stats.
 * @param {boolean} isCorrect
 */
export const submitAnswer = (isCorrect) => statsStore.update((s) => recordAnswer(s, isCorrect));

/** Resets all stats to zero and returns them. */
export const resetStats = () => statsStore.set(createEmptyStats());

export const messageHandlers = {
  [MESSAGE_TYPES.GET_STATS]: async () => ({ stats: await getStats() }),
  [MESSAGE_TYPES.SUBMIT_ANSWER]: async (message) => ({
    stats: await submitAnswer(Boolean(message.isCorrect)),
  }),
  [MESSAGE_TYPES.RESET_STATS]: async () => ({ stats: await resetStats() }),
};
