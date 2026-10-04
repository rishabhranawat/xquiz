// Exercises the service worker modules against an in-memory fake of the
// chrome.* APIs: persistence across "worker restarts" and message routing.

import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { dateKey } from '../src/shared/daily-log.js';

let storage;
let messageListener;

function installFakeChrome() {
  storage = {};
  messageListener = null;
  globalThis.chrome = {
    runtime: {
      id: 'self',
      onMessage: { addListener: (fn) => (messageListener = fn) },
      sendMessage: async () => undefined,
    },
    storage: {
      local: {
        get: async (keys) => {
          const list = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(list.filter((k) => k in storage).map((k) => [k, storage[k]]));
        },
        set: async (items) => Object.assign(storage, structuredClone(items)),
      },
      sync: { get: async () => ({}), set: async () => {} },
    },
  };
}

/** Fresh module instances simulate a restarted service worker. */
const load = (path) => import(`${path}?restart=${Math.random()}`);

beforeEach(installFakeChrome);

test('quiz queue survives a service worker restart', async () => {
  const first = await load('../src/background/quiz-queue.js');
  await first.enqueueQuiz({ question: 'one' });
  await first.enqueueQuiz({ question: 'two' });

  const second = await load('../src/background/quiz-queue.js'); // new worker, empty memory
  assert.equal((await second.dequeueQuiz()).question, 'one');
  assert.equal((await second.dequeueQuiz()).question, 'two');
  assert.equal(await second.dequeueQuiz(), null);
});

test('stats persist and concurrent submissions do not race', async () => {
  const first = await load('../src/background/stats.js');
  await Promise.all([
    first.submitAnswer(true),
    first.submitAnswer(true),
    first.submitAnswer(false),
  ]);

  const second = await load('../src/background/stats.js');
  assert.deepEqual(await second.getStats(), {
    totalQuestions: 3,
    correctAnswers: 2,
    currentStreak: 0,
    bestStreak: 2,
  });
  assert.equal((await second.resetStats()).totalQuestions, 0);
});

test('daily answer log persists, rides along GET_STATS, and legacy stats still load', async () => {
  storage.stats = { totalQuestions: 10, correctAnswers: 7, currentStreak: 1, bestStreak: 4 };
  const first = await load('../src/background/stats.js');
  const day = new Date();
  await first.submitAnswer(true, day);
  await first.submitAnswer(false, day);

  const second = await load('../src/background/stats.js'); // restarted worker
  const response = await second.messageHandlers.GET_STATS();
  assert.equal(response.stats.totalQuestions, 12);
  assert.deepEqual(response.dailyLog, { [dateKey(day)]: { answered: 2, correct: 1 } });

  await second.resetStats();
  assert.deepEqual(await second.getDailyLog(), {});
});

test('message router always responds, including unknown types and failures', async () => {
  const { registerMessageRouter } = await load('../src/shared/messaging.js');
  registerMessageRouter({
    PING: () => ({ pong: true }),
    VOID: async () => undefined,
    BOOM: () => {
      throw new Error('boom');
    },
  });

  const call = (message, sender = { id: 'self' }) =>
    new Promise((resolve) => {
      const keepOpen = messageListener(message, sender, resolve);
      if (!keepOpen) return; // responded synchronously
    });

  assert.deepEqual(await call({ type: 'PING' }), { pong: true });
  assert.deepEqual(await call({ type: 'VOID' }), {});
  assert.deepEqual(await call({ type: 'BOOM' }), { error: 'boom' });
  assert.deepEqual(await call({ type: 'NOPE' }), { error: 'UNKNOWN_MESSAGE' });
  assert.deepEqual(await call({ type: 'toString' }), { error: 'UNKNOWN_MESSAGE' });
  assert.deepEqual(await call({}), { error: 'UNKNOWN_MESSAGE' });
  assert.deepEqual(await call({ type: 'PING' }, { id: 'other' }), { error: 'UNAUTHORIZED' });
});

test('TWEETS_COLLECTED responds on the failure path without an API key', async () => {
  const { messageHandlers } = await load('../src/background/quiz-generator.js');
  const tweets = [{ id: '1', contentHash: 'h', author: 'a', text: 'hello world, this is a tweet' }];

  const result = await messageHandlers.TWEETS_COLLECTED({ tweets });
  assert.equal(result.success, false);
  assert.match(result.error, /API key not configured/);

  const invalid = await messageHandlers.TWEETS_COLLECTED({ tweets: 'nope' });
  assert.equal(invalid.success, false);
});

test('generateQuiz sends the API key in a header, never in the URL', async () => {
  storage.apiKey = 'SECRET-KEY';
  const { generateQuiz } = await load('../src/background/quiz-generator.js');
  const quiz = { type: 'true_false', question: 'Q?', answer: 'true' };
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return {
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(quiz) }] } }],
      }),
    };
  };

  const result = await generateQuiz([
    { id: '1', contentHash: 'h', author: 'a', text: 'some tweet text' },
  ]);
  assert.equal(result.quiz.question, 'Q?');
  assert.equal(result.quiz.tweetCount, 1);
  assert.doesNotMatch(request.url, /SECRET-KEY|key=/);
  assert.equal(request.init.headers['x-goog-api-key'], 'SECRET-KEY');
  assert.equal(JSON.parse(request.init.body).generationConfig.responseMimeType, 'application/json');

  // The same tweet is not quizzed twice.
  const again = await generateQuiz([
    { id: '1', contentHash: 'h', author: 'a', text: 'some tweet text' },
  ]);
  assert.match(again.error, /already been used|have been used/);
});
