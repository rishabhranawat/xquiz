import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_DWELL_MS,
  MIN_DWELL_MS,
  TOP_N,
  countWords,
  expectedReadingMs,
  intentScore,
  rankPosts,
} from '../src/shared/ranking.js';

const words = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const post = (id, wordCount, dwellMs, extra = {}) => ({
  id,
  text: words(wordCount),
  dwellMs,
  ...extra,
});

test('countWords handles whitespace and empty input', () => {
  assert.equal(countWords('  hello   world \n again '), 3);
  assert.equal(countWords(''), 0);
  assert.equal(countWords(undefined), 0);
});

test('expected reading time follows 238 wpm with a floor', () => {
  assert.equal(Math.round(expectedReadingMs(words(238))), 60_000);
  assert.equal(expectedReadingMs('hi'), 2000);
});

test('dwell below the threshold scores zero', () => {
  assert.equal(intentScore(post('a', 5, MIN_DWELL_MS - 1)), 0);
  assert.ok(intentScore(post('a', 5, MIN_DWELL_MS)) > 0);
  assert.equal(intentScore({ text: 'x', dwellMs: NaN }), 0);
  assert.equal(intentScore(null), 0);
});

test('a long post read at pace outranks a quick glance at a long post', () => {
  const read = intentScore(post('a', 200, 50_000));
  const glance = intentScore(post('b', 200, 3_000));
  assert.ok(read > glance * 3);
});

test('a long post read at pace outranks a one-liner briefly noticed', () => {
  assert.ok(intentScore(post('a', 200, 50_000)) > intentScore(post('b', 8, 4_000)));
});

test('score grows with dwell for the same post', () => {
  assert.ok(intentScore(post('a', 100, 20_000)) > intentScore(post('a', 100, 10_000)));
});

test('very long dwell is capped as probable idleness', () => {
  const capped = intentScore(post('a', 50, MAX_DWELL_MS));
  assert.equal(intentScore(post('a', 50, MAX_DWELL_MS * 10)), capped);
});

test('completion saturates: reading far beyond the expected time adds little', () => {
  const atPace = intentScore(post('a', 238, 60_000));
  const fastRead = intentScore(post('b', 238, 20_000));
  assert.ok(atPace > fastRead);
  // 10x the expected time on a one-liner is still bounded by the dwell cap.
  assert.ok(intentScore(post('c', 5, 120_000)) < intentScore(post('d', 400, 120_000)) * 2);
});

test('revisits add a capped bonus', () => {
  const base = intentScore(post('a', 50, 10_000));
  const twice = intentScore(post('a', 50, 10_000, { visits: 2 }));
  const many = intentScore(post('a', 50, 10_000, { visits: 50 }));
  assert.ok(twice > base);
  assert.ok(many > twice);
  assert.equal(many, intentScore(post('a', 50, 10_000, { visits: 4 })));
  assert.equal(intentScore(post('a', 50, 10_000, { visits: 0 })), base);
});

test('rankPosts sorts by score, drops glances and limits to the top 10', () => {
  const posts = [
    post('glance', 100, 1_000),
    ...Array.from({ length: 14 }, (_, i) => post(`p${i}`, 60, 8_000 + i * 1_000)),
  ];
  const ranked = rankPosts(posts);
  assert.equal(ranked.length, TOP_N);
  assert.equal(ranked[0].id, 'p13');
  assert.ok(!ranked.some((p) => p.id === 'glance'));
  assert.deepEqual(
    ranked.map((p) => p.score),
    [...ranked.map((p) => p.score)].sort((a, b) => b - a)
  );
  assert.equal(rankPosts(posts, 3).length, 3);
});

test('rankPosts does not mutate input and breaks ties by recency', () => {
  const posts = [
    post('old', 40, 10_000, { lastSeen: 1 }),
    post('new', 40, 10_000, { lastSeen: 2 }),
  ];
  const ranked = rankPosts(posts);
  assert.deepEqual(
    ranked.map((p) => p.id),
    ['new', 'old']
  );
  assert.equal('score' in posts[0], false);
  assert.deepEqual(rankPosts([]), []);
});
