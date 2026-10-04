import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  handleFromHref,
  isQuizWorthyText,
  statusIdFromHref,
} from '../src/content/tweet-extractor.js';
import { createTweetCollector } from '../src/content/tweet-collector.js';

test('handleFromHref extracts handles from profile links only', () => {
  assert.equal(handleFromHref('/jack'), 'jack');
  assert.equal(handleFromHref('/Jack_99'), 'Jack_99');
  assert.equal(handleFromHref('/jack/status/123'), null);
  assert.equal(handleFromHref('/jack?lang=en'), null);
  assert.equal(handleFromHref('/i'), null);
  assert.equal(handleFromHref('/explore'), null);
  assert.equal(handleFromHref('/'), null);
  assert.equal(handleFromHref(null), null);
  assert.equal(handleFromHref('https://x.com/jack'), null);
});

test('statusIdFromHref finds numeric status ids', () => {
  assert.equal(statusIdFromHref('/jack/status/1234567890'), '1234567890');
  assert.equal(statusIdFromHref('/jack/status/1234567890/analytics'), '1234567890');
  assert.equal(statusIdFromHref('/jack'), null);
  assert.equal(statusIdFromHref(null), null);
});

test('isQuizWorthyText filters short and promoted text', () => {
  assert.equal(isQuizWorthyText('too short'), false);
  assert.equal(isQuizWorthyText('This tweet is long enough to be quizzed on.'), true);
  assert.equal(isQuizWorthyText('Promoted content that is quite long indeed'), false);
});

test('tweet collector de-duplicates by id and content hash and drains', () => {
  const collector = createTweetCollector();
  assert.equal(collector.add({ id: '1', contentHash: 'h1' }), true);
  assert.equal(collector.add({ id: '1', contentHash: 'h2' }), false);
  assert.equal(collector.add({ id: '2', contentHash: 'h1' }), false);
  assert.equal(collector.add({ id: '3', contentHash: 'h3' }), true);
  assert.equal(collector.size, 2);
  assert.equal(collector.hasSeen('h1'), true);

  assert.deepEqual(
    collector.drain().map((t) => t.id),
    ['1', '3']
  );
  assert.equal(collector.size, 0);
  // Drained tweets are still remembered, so they are never re-collected.
  assert.equal(collector.add({ id: '1', contentHash: 'h1' }), false);
});
