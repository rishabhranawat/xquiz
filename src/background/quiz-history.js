/**
 * Log of the quizzes that were shown to the user (newest first, capped).
 */

import { LIMITS, MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { createStore } from './store.js';

const historyStore = createStore(
  STORAGE_KEYS.QUIZ_HISTORY,
  () => [],
  (raw) => (Array.isArray(raw) ? raw : [])
);

/**
 * Builds the compact record stored for a served quiz.
 * @param {object} quiz
 * @param {{id?: string, now?: number}} [overrides] Injectable for tests.
 */
export function createHistoryEntry(quiz, { id = crypto.randomUUID(), now = Date.now() } = {}) {
  return {
    id,
    timestamp: now,
    type: quiz.type,
    question: quiz.question,
    options: quiz.options || null,
    answer: quiz.answer || '',
    explanation: quiz.explanation || '',
    tweetCount: quiz.tweetCount || (quiz.tweets?.length ?? 0),
  };
}

/**
 * Prepends an entry and trims to `max` items.
 * @param {object[]} history
 * @param {object} entry
 * @param {number} [max]
 */
export function prependToHistory(history, entry, max = LIMITS.MAX_QUIZ_HISTORY) {
  return [entry, ...history].slice(0, max);
}

/** @param {object} quiz The quiz that was just shown. */
export async function addToHistory(quiz) {
  await historyStore.update((history) => prependToHistory(history, createHistoryEntry(quiz)));
}

export const messageHandlers = {
  [MESSAGE_TYPES.GET_QUIZ_HISTORY]: async () => ({ history: await historyStore.get() }),
  [MESSAGE_TYPES.CLEAR_QUIZ_HISTORY]: async () => {
    await historyStore.set([]);
    return { success: true };
  },
};
