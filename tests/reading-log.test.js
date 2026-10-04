import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addBatchToLog,
  buildPostUrl,
  capPosts,
  mergePosts,
  sanitizePost,
  summarizeDay,
} from '../src/background/reading-log.js';
import { DIGEST_LIMITS } from '../src/shared/digest-constants.js';
import { shiftDay } from '../src/shared/day.js';

const NOW = new Date(2026, 0, 10, 12).getTime();
const raw = (overrides = {}) => ({
  id: '1800000000000000001',
  author: 'jack',
  displayName: 'Jack',
  text: 'hello world',
  hasMedia: false,
  dwellMs: 4000,
  visits: 1,
  firstSeen: NOW - 5000,
  lastSeen: NOW,
  ...overrides,
});

test('buildPostUrl builds permalinks from validated parts only', () => {
  assert.equal(
    buildPostUrl('jack', '1800000000000000001'),
    'https://x.com/jack/status/1800000000000000001'
  );
  assert.equal(buildPostUrl('jack', '-12345678'), 'https://x.com/jack'); // hash fallback id
  assert.equal(buildPostUrl('ja/ck', '1800000000000000001'), null);
  assert.equal(buildPostUrl('evil.com/x?', '1800000000000000001'), null);
});

test('sanitizePost normalizes a valid post and truncates text', () => {
  const post = sanitizePost(raw({ text: 'x'.repeat(900), author: '@jack' }), NOW);
  assert.equal(post.text.length, DIGEST_LIMITS.MAX_TEXT_LENGTH);
  assert.equal(post.author, 'jack');
  assert.equal(post.url, 'https://x.com/jack/status/1800000000000000001');
});

test('sanitizePost ignores a url supplied by the page', () => {
  const post = sanitizePost(raw({ url: 'https://evil.example/phish' }), NOW);
  assert.equal(post.url, 'https://x.com/jack/status/1800000000000000001');
});

test('sanitizePost rejects ads, empty text, bad dwell and junk', () => {
  assert.equal(sanitizePost(raw({ promoted: true }), NOW), null);
  assert.equal(sanitizePost(raw({ text: '   ' }), NOW), null);
  assert.equal(sanitizePost(raw({ id: '' }), NOW), null);
  assert.equal(sanitizePost(raw({ dwellMs: 0 }), NOW), null);
  assert.equal(sanitizePost(raw({ dwellMs: 'lots' }), NOW), null);
  assert.equal(sanitizePost(null, NOW), null);
  assert.equal(sanitizePost('x', NOW), null);
});

test('sanitizePost fills defaults and bounds a single batch entry', () => {
  const post = sanitizePost({ id: 'h1', text: 'hi', dwellMs: 99_999_999 }, NOW);
  assert.equal(post.author, 'unknown');
  assert.equal(post.displayName, 'unknown');
  assert.equal(post.dwellMs, 600_000);
  assert.equal(post.visits, 1);
  assert.equal(post.lastSeen, NOW);
  assert.equal(post.firstSeen, NOW);
});

test('mergePosts aggregates dwell, visits and timestamps by id', () => {
  const a = sanitizePost(raw({ dwellMs: 3000, visits: 1, firstSeen: 100, lastSeen: 200 }), NOW);
  const b = sanitizePost(
    raw({
      dwellMs: 2500,
      visits: 2,
      firstSeen: 150,
      lastSeen: 900,
      hasMedia: true,
      text: 'edited',
    }),
    NOW
  );
  const merged = mergePosts(mergePosts({}, [a]), [b]);
  assert.equal(Object.keys(merged).length, 1);
  const post = merged[a.id];
  assert.equal(post.dwellMs, 5500);
  assert.equal(post.visits, 3);
  assert.equal(post.firstSeen, 100);
  assert.equal(post.lastSeen, 900);
  assert.equal(post.hasMedia, true);
  assert.equal(post.text, 'edited');
});

test('mergePosts does not mutate its input', () => {
  const a = sanitizePost(raw(), NOW);
  const day = mergePosts({}, [a]);
  const snapshot = structuredClone(day);
  mergePosts(day, [sanitizePost(raw({ dwellMs: 1000 }), NOW)]);
  assert.deepEqual(day, snapshot);
});

test('capPosts keeps the posts with the most dwell', () => {
  const posts = {};
  for (let i = 0; i < 10; i++) posts[`p${i}`] = { id: `p${i}`, dwellMs: i * 100, lastSeen: i };
  const capped = capPosts(posts, 4);
  assert.deepEqual(Object.keys(capped).sort(), ['p6', 'p7', 'p8', 'p9']);
  assert.equal(capPosts(posts, 100), posts);
});

test('a day is capped at ~500 posts', () => {
  let log = {};
  const batch = (from) =>
    Array.from({ length: 100 }, (_, i) => raw({ id: `${from + i}`, dwellMs: 2000 + from + i }));
  for (let from = 0; from < 600; from += 100)
    log = addBatchToLog(log, batch(from), '2026-01-10', NOW);
  const posts = log['2026-01-10'];
  assert.equal(Object.keys(posts).length, DIGEST_LIMITS.MAX_POSTS_PER_DAY);
  assert.ok(!('0' in posts)); // lowest dwell evicted
  assert.ok('599' in posts);
});

test('addBatchToLog buckets by day, prunes old days and ignores invalid posts', () => {
  const today = '2026-01-10';
  let log = {};
  for (let i = 0; i < 9; i++) {
    log = addBatchToLog(log, [raw({ id: `old${i}` })], shiftDay(today, -(9 - i)), NOW);
  }
  log = addBatchToLog(
    log,
    [raw(), null, { id: 'x' }, raw({ promoted: true, id: 'ad' })],
    today,
    NOW
  );
  assert.equal(Object.keys(log).length, DIGEST_LIMITS.RETENTION_DAYS);
  assert.ok(!(shiftDay(today, -7) in log));
  assert.ok(shiftDay(today, -6) in log);
  assert.deepEqual(Object.keys(log[today]), ['1800000000000000001']);
});

test('addBatchToLog tolerates a non-array batch and caps batch size', () => {
  assert.deepEqual(addBatchToLog({}, 'nope', '2026-01-10', NOW), {});
  const huge = Array.from({ length: 1000 }, (_, i) => raw({ id: `${i}` }));
  const log = addBatchToLog({}, huge, '2026-01-10', NOW);
  assert.equal(Object.keys(log['2026-01-10']).length, DIGEST_LIMITS.MAX_BATCH_POSTS);
});

test('summarizeDay totals all tracked posts', () => {
  assert.deepEqual(summarizeDay(undefined), { postCount: 0, totalDwellMs: 0 });
  const day = mergePosts({}, [
    sanitizePost(raw({ dwellMs: 1000 }), NOW),
    sanitizePost(raw({ id: '2', dwellMs: 2000 }), NOW),
  ]);
  assert.deepEqual(summarizeDay(day), { postCount: 2, totalDwellMs: 3000 });
});
