import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashTweet } from '../src/shared/tweet-hash.js';

test('hashTweet is deterministic and case-insensitive', () => {
  assert.equal(hashTweet('Jack', 'Hello World'), hashTweet('jack', 'hello world'));
  assert.match(hashTweet('jack', 'hello'), /^-?\d+$/);
});

test('hashTweet distinguishes authors and text', () => {
  assert.notEqual(hashTweet('jack', 'hello'), hashTweet('jill', 'hello'));
  assert.notEqual(hashTweet('jack', 'hello'), hashTweet('jack', 'goodbye'));
});

test('hashTweet only considers the first 100 characters of text', () => {
  const prefix = 'x'.repeat(100);
  assert.equal(hashTweet('a', `${prefix}one`), hashTweet('a', `${prefix}two`));
  assert.notEqual(hashTweet('a', `${prefix.slice(1)}one`), hashTweet('a', `${prefix}one`));
});

test('hashTweet matches the legacy djb2 implementation', () => {
  // Known value computed with the original content-script implementation.
  assert.equal(hashTweet('', ''), '58');
  assert.equal(hashTweet('a', 'b'), '95113');
});
