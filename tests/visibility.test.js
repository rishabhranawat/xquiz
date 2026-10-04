import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPostVisible } from '../src/shared/visibility.js';

const sample = (overrides) => ({
  isIntersecting: true,
  intersectionRatio: 1,
  visibleHeight: 200,
  viewportHeight: 800,
  ...overrides,
});

test('a post must intersect at all', () => {
  assert.equal(isPostVisible(sample({ isIntersecting: false })), false);
});

test('60% of the post on screen counts, less does not', () => {
  assert.equal(isPostVisible(sample({ intersectionRatio: 0.6 })), true);
  assert.equal(isPostVisible(sample({ intersectionRatio: 0.59, visibleHeight: 100 })), false);
});

test('tall posts count when they fill 60% of the viewport', () => {
  const tall = { intersectionRatio: 0.3, viewportHeight: 800 };
  assert.equal(isPostVisible(sample({ ...tall, visibleHeight: 480 })), true);
  assert.equal(isPostVisible(sample({ ...tall, visibleHeight: 479 })), false);
});
