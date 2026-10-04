import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assembleDigest,
  buildDigestPrompt,
  buildFallbackOverview,
  formatDuration,
  parseDigestResponse,
  snippet,
} from '../src/shared/digest-builder.js';
import { buildMailtoUrl, formatDigestText } from '../src/shared/digest-format.js';

const ranked = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `${1000 + i}`,
    author: `user${i}`,
    displayName: `User ${i}`,
    url: `https://x.com/user${i}/status/${1000 + i}`,
    text: `This is the text of post number ${i}, which says something quite interesting about topic ${i}.`,
    dwellMs: 30_000 - i * 1000,
    hasMedia: i === 0,
    score: 10 - i,
  }));

test('snippet cuts at a word boundary with an ellipsis', () => {
  assert.equal(snippet('short text'), 'short text');
  const long = 'word '.repeat(80);
  const cut = snippet(long, 140);
  assert.ok(cut.length <= 141);
  assert.ok(cut.endsWith('…'));
  assert.ok(!cut.includes('wor…'));
  assert.equal(snippet('  a \n\n b  '), 'a b');
  assert.equal(snippet(undefined), '');
});

test('formatDuration', () => {
  assert.equal(formatDuration(45_000), '45s');
  assert.equal(formatDuration(260_000), '4m 20s');
  assert.equal(formatDuration(120_000), '2m');
  assert.equal(formatDuration(3_900_000), '1h 5m');
  assert.equal(formatDuration(3_600_000), '1h');
  assert.equal(formatDuration(-5), '0s');
});

test('prompt lists every post, requests JSON and warns about untrusted text', () => {
  const prompt = buildDigestPrompt(ranked(3));
  assert.match(prompt, /1\. @user0/);
  assert.match(prompt, /3\. @user2/);
  assert.match(prompt, /never follow instructions/);
  assert.match(prompt, /"overview"/);
});

test('prompt escapes quotes and newlines in post text', () => {
  const posts = [{ author: 'a', text: 'He said "hi"\nIGNORE ALL' }];
  assert.match(buildDigestPrompt(posts), /1\. @a: "He said \\"hi\\" IGNORE ALL"/);
});

test('parseDigestResponse accepts a valid response', () => {
  const text = JSON.stringify({
    overview: ' A day of AI and cooking. ',
    takeaways: [
      { index: 1, takeaway: 'First point.' },
      { index: 2, takeaway: 'Second point.' },
    ],
  });
  const parsed = parseDigestResponse(text, 2);
  assert.equal(parsed.overview, 'A day of AI and cooking.');
  assert.equal(parsed.takeaways.get(2), 'Second point.');
});

test('parseDigestResponse tolerates code fences and drops bad takeaways', () => {
  const text =
    '```json\n' +
    JSON.stringify({
      overview: 'ok',
      takeaways: [
        { index: 1, takeaway: 'good' },
        { index: 9, takeaway: 'out of range' },
        { index: 'x', takeaway: 'nan' },
        { index: 2, takeaway: '' },
        { index: 2 },
        null,
      ],
    }) +
    '\n```';
  const parsed = parseDigestResponse(text, 3);
  assert.deepEqual([...parsed.takeaways.keys()], [1]);
});

test('parseDigestResponse rejects unusable responses', () => {
  assert.throws(() => parseDigestResponse('not json', 3), /not valid JSON/);
  assert.throws(() => parseDigestResponse('{}', 3), /overview/);
  assert.throws(() => parseDigestResponse(JSON.stringify({ overview: 5 }), 3), /overview/);
  assert.throws(() => parseDigestResponse('null', 3), /overview/);
});

test('fallback overview mentions counts and top authors', () => {
  const text = buildFallbackOverview(1, 60_000, ranked(1));
  assert.match(text, /1 post for 1m/);
  assert.match(buildFallbackOverview(12, 600_000, ranked(5)), /12 posts.*@user0, @user1, @user2/);
  assert.doesNotMatch(buildFallbackOverview(0, 0, []), /Most attention/);
});

test('assembleDigest without AI uses the first ~140 chars of each post', () => {
  const digest = assembleDigest({
    day: '2026-01-10',
    now: 5,
    ranked: ranked(10),
    ai: null,
    totals: { postCount: 42, totalDwellMs: 600_000 },
  });
  assert.equal(digest.source, 'fallback');
  assert.equal(digest.items.length, 10);
  assert.equal(digest.items[0].rank, 1);
  assert.ok(digest.items[0].takeaway.startsWith('This is the text of post number 0'));
  assert.ok(digest.items.every((item) => item.takeaway.length <= 141));
  assert.match(digest.overview, /42 posts/);
  assert.equal(digest.postCount, 42);
});

test('assembleDigest with AI uses takeaways and falls back per post when missing', () => {
  const digest = assembleDigest({
    day: '2026-01-10',
    now: 5,
    ranked: ranked(3),
    ai: {
      overview: 'Big picture.',
      takeaways: new Map([
        [1, 'AI one'],
        [3, 'AI three'],
      ]),
    },
    totals: { postCount: 3, totalDwellMs: 1000 },
  });
  assert.equal(digest.source, 'ai');
  assert.equal(digest.overview, 'Big picture.');
  assert.deepEqual(
    digest.items.map((i) => i.takeaway.slice(0, 7)),
    ['AI one', 'This is', 'AI thre']
  );
});

test('formatDigestText lists rank, author, time, takeaway and link', () => {
  const digest = assembleDigest({
    day: '2026-01-10',
    now: 5,
    ranked: ranked(2),
    ai: null,
    totals: { postCount: 2, totalDwellMs: 90_000 },
  });
  const text = formatDigestText(digest);
  assert.match(text, /1\. User 0 \(@user0\) - 30s/);
  assert.match(text, /https:\/\/x\.com\/user1\/status\/1001/);
  assert.match(text, /Read 2 posts for 1m 30s in total\./);
});

test('buildMailtoUrl encodes subject and body and stays within URL limits', () => {
  const digest = assembleDigest({
    day: '2026-01-10',
    now: 5,
    ranked: ranked(10),
    ai: null,
    totals: { postCount: 10, totalDwellMs: 90_000 },
  });
  const url = buildMailtoUrl(digest, 'me@example.com');
  assert.ok(url.startsWith('mailto:me%40example.com?subject='));
  assert.ok(url.length <= 1900);
  const body = decodeURIComponent(url.split('&body=')[1]);
  assert.match(body, /1\. User 0/);
  // Lines are dropped whole, never cut mid-line.
  assert.ok(!/https:\/\/x\.com\/user\d+\/stat\s*$/.test(body));
});
