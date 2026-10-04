/**
 * Pure quiz statistics helpers (no chrome APIs). Persistence lives in
 * background/stats.js.
 */

import { DEFAULT_STATS } from './constants.js';

/** @typedef {{totalQuestions: number, correctAnswers: number, currentStreak: number, bestStreak: number}} Stats */

/** @returns {Stats} a fresh, zeroed stats object. */
export function createEmptyStats() {
  return { ...DEFAULT_STATS };
}

/**
 * Coerces stored stats into a valid object (missing fields become 0).
 * @param {Partial<Stats> | null | undefined} raw
 * @returns {Stats}
 */
export function normalizeStats(raw) {
  const stats = createEmptyStats();
  for (const key of Object.keys(stats)) {
    const value = raw?.[key];
    if (Number.isFinite(value) && value >= 0) stats[key] = value;
  }
  return stats;
}

/**
 * Returns new stats after an answer. Does not mutate its input.
 * @param {Stats} stats
 * @param {boolean} isCorrect
 * @returns {Stats}
 */
export function recordAnswer(stats, isCorrect) {
  const next = { ...stats, totalQuestions: stats.totalQuestions + 1 };
  if (isCorrect) {
    next.correctAnswers += 1;
    next.currentStreak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
  } else {
    next.currentStreak = 0;
  }
  return next;
}

/**
 * Accuracy as a rounded percentage, or null when nothing was answered yet.
 * @param {Stats} stats
 * @returns {number | null}
 */
export function accuracyPercent(stats) {
  if (stats.totalQuestions <= 0) return null;
  return Math.round((stats.correctAnswers / stats.totalQuestions) * 100);
}
