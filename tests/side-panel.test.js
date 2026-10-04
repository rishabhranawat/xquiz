import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isXUrl } from '../src/background/side-panel.js';

test('isXUrl matches only x.com and twitter.com', () => {
  assert.equal(isXUrl('https://x.com/home'), true);
  assert.equal(isXUrl('https://twitter.com/jack'), true);
  assert.equal(isXUrl('https://example.com/x.com'), false);
  assert.equal(isXUrl('https://notx.com/'), false);
  assert.equal(isXUrl(undefined), false);
  assert.equal(isXUrl('not a url'), false);
});
