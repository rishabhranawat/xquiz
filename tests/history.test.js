import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHistoryEntry, prependToHistory } from '../src/background/quiz-history.js';
import { addUsedTweetKeys, filterUnusedTweets, tweetKey } from '../src/background/tweet-history.js';

test('createHistoryEntry keeps a compact copy of the quiz', () => {
  const entry = createHistoryEntry(
    { type: 'fill_blank', question: 'Q', answer: 'A', tweets: [{}, {}] },
    { id: 'id-1', now: 123 }
  );
  assert.deepEqual(entry, {
    id: 'id-1',
    timestamp: 123,
    type: 'fill_blank',
    question: 'Q',
    options: null,
    answer: 'A',
    explanation: '',
    tweetCount: 2,
  });
});

test('prependToHistory puts newest first and caps the length', () => {
  assert.deepEqual(prependToHistory([{ id: 1 }, { id: 2 }], { id: 3 }, 2), [{ id: 3 }, { id: 1 }]);
});

test('tweetKey prefers the content hash', () => {
  assert.equal(tweetKey({ id: '1', contentHash: 'h' }), 'h');
  assert.equal(tweetKey({ id: '1' }), '1');
});

test('filterUnusedTweets drops already used tweets', () => {
  const tweets = [{ contentHash: 'a' }, { contentHash: 'b' }, { id: 'c' }];
  assert.deepEqual(filterUnusedTweets(tweets, ['b', 'c']), [{ contentHash: 'a' }]);
});

test('addUsedTweetKeys appends and keeps only the newest keys', () => {
  assert.deepEqual(addUsedTweetKeys(['a'], [{ contentHash: 'b' }]), ['a', 'b']);
  assert.deepEqual(addUsedTweetKeys(['a', 'b'], [{ contentHash: 'c' }, { contentHash: 'd' }], 3), [
    'b',
    'c',
    'd',
  ]);
});
