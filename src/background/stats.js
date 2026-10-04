/**
 * Persisted quiz statistics (score, streaks) and the per-day answer log used
 * by the scorecard. Pure logic is in shared/stats.js and shared/daily-log.js.
 */

import { MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { createEmptyLog, normalizeLog, recordDailyAnswer } from '../shared/daily-log.js';
import { createEmptyStats, normalizeStats, recordAnswer } from '../shared/stats.js';
import { createStore } from './store.js';

const statsStore = createStore(STORAGE_KEYS.STATS, createEmptyStats, normalizeStats);
const dailyLogStore = createStore(STORAGE_KEYS.DAILY_LOG, createEmptyLog, (raw) =>
  normalizeLog(raw)
);

/** Returns the current stats. */
export const getStats = () => statsStore.get();

/** Returns the per-day answer log (last 30 days). */
export const getDailyLog = () => dailyLogStore.get();

/**
 * Records an answer and returns the updated stats.
 * @param {boolean} isCorrect
 * @param {Date} [now] Injectable for tests.
 */
export async function submitAnswer(isCorrect, now = new Date()) {
  const [stats] = await Promise.all([
    statsStore.update((s) => recordAnswer(s, isCorrect)),
    dailyLogStore.update((log) => recordDailyAnswer(log, isCorrect, now)),
  ]);
  return stats;
}

/** Resets all stats (and the daily log) to zero and returns the stats. */
export async function resetStats() {
  await dailyLogStore.set(createEmptyLog());
  return statsStore.set(createEmptyStats());
}

export const messageHandlers = {
  [MESSAGE_TYPES.GET_STATS]: async () => ({
    stats: await getStats(),
    dailyLog: await getDailyLog(),
  }),
  [MESSAGE_TYPES.SUBMIT_ANSWER]: async (message) => ({
    stats: await submitAnswer(Boolean(message.isCorrect)),
  }),
  [MESSAGE_TYPES.RESET_STATS]: async () => ({ stats: await resetStats() }),
};
