/**
 * Queue of generated quizzes waiting to be shown in the side panel.
 * Persisted so quizzes survive service worker restarts.
 */

import { LIMITS, MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { createStore } from './store.js';
import { addToHistory } from './quiz-history.js';

const EMPTY_QUEUE_MESSAGE = 'Keep scrolling! Quiz will appear after reading more tweets.';

const queueStore = createStore(
  STORAGE_KEYS.QUIZ_QUEUE,
  () => [],
  (raw) => (Array.isArray(raw) ? raw : [])
);

/**
 * Appends a quiz (dropping the oldest when the queue is full).
 * @param {object} quiz
 */
export async function enqueueQuiz(quiz) {
  await queueStore.update((queue) => [...queue, quiz].slice(-LIMITS.MAX_QUEUED_QUIZZES));
}

/** Removes and returns the oldest queued quiz, or null when empty. */
export async function dequeueQuiz() {
  let next = null;
  await queueStore.update(([first = null, ...rest]) => {
    next = first;
    return rest;
  });
  return next;
}

export const messageHandlers = {
  [MESSAGE_TYPES.REQUEST_QUIZ]: async () => {
    const quiz = await dequeueQuiz();
    if (!quiz) return { quiz: null, message: EMPTY_QUEUE_MESSAGE };
    await addToHistory(quiz);
    return { quiz };
  },
};
