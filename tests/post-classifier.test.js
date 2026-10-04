import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyPost, shouldHidePost, stripMediaLinks } from '../src/content/post-classifier.js';

const post = (overrides) => ({ hasVideo: false, hasImage: false, text: '', ...overrides });

test('stripMediaLinks removes media links, invisible chars and whitespace', () => {
  assert.equal(stripMediaLinks(''), '');
  assert.equal(stripMediaLinks(null), '');
  assert.equal(stripMediaLinks('   \n\t '), '');
  assert.equal(stripMediaLinks('https://t.co/AbC123'), '');
  assert.equal(stripMediaLinks('t.co/AbC123'), '');
  assert.equal(stripMediaLinks('pic.twitter.com/xyz'), '');
  assert.equal(stripMediaLinks('pic.x.com/xyz'), '');
  assert.equal(stripMediaLinks(' ​ https://t.co/a https://t.co/b '), '');
  assert.equal(stripMediaLinks('look https://t.co/a'), 'look');
});

test('classifyPost: video wins over everything', () => {
  assert.equal(classifyPost(post({ hasVideo: true })), 'video');
  assert.equal(classifyPost(post({ hasVideo: true, hasImage: true, text: 'hello' })), 'video');
});

test('classifyPost: images with no text of their own are image-only', () => {
  assert.equal(classifyPost(post({ hasImage: true })), 'image-only');
  assert.equal(classifyPost(post({ hasImage: true, text: '  \n ' })), 'image-only');
  assert.equal(classifyPost(post({ hasImage: true, text: 'https://t.co/abc' })), 'image-only');
  assert.equal(classifyPost(post({ hasImage: true, text: 'pic.x.com/abc' })), 'image-only');
});

test('classifyPost: any real text keeps the post visible', () => {
  assert.equal(classifyPost(post({ hasImage: true, text: 'Nice view' })), 'text');
  assert.equal(classifyPost(post({ hasImage: true, text: '#sunset' })), 'text');
  assert.equal(classifyPost(post({ hasImage: true, text: '🔥' })), 'text');
  assert.equal(classifyPost(post({ hasImage: true, text: 'see https://t.co/a' })), 'text');
});

test('classifyPost: posts without media are text, even when empty', () => {
  assert.equal(classifyPost(post({ text: 'just words here' })), 'text');
  assert.equal(classifyPost(post({})), 'text');
  assert.equal(classifyPost(post({ text: 'https://t.co/a' })), 'text');
});

test('classifyPost: quote tweets are judged on the combined text', () => {
  // Commentary-free quote of an image-only post: no text anywhere -> image-only.
  assert.equal(classifyPost(post({ hasImage: true, text: ' ' })), 'image-only');
  // Quote with commentary, or quoting a post that has text, stays visible.
  assert.equal(classifyPost(post({ hasImage: true, text: 'lol  quoted caption' })), 'text');
});

test('shouldHidePost does nothing while distraction mode is off', () => {
  const off = { distractionMode: false, hideVideos: true, hideImageOnly: true };
  assert.equal(shouldHidePost('video', off), false);
  assert.equal(shouldHidePost('image-only', off), false);
});

test('shouldHidePost honours the sub-options', () => {
  const base = { distractionMode: true, hideVideos: true, hideImageOnly: true };
  assert.equal(shouldHidePost('video', base), true);
  assert.equal(shouldHidePost('image-only', base), true);
  assert.equal(shouldHidePost('text', base), false);
  assert.equal(shouldHidePost('video', { ...base, hideVideos: false }), false);
  assert.equal(shouldHidePost('image-only', { ...base, hideVideos: false }), true);
  assert.equal(shouldHidePost('image-only', { ...base, hideImageOnly: false }), false);
  assert.equal(shouldHidePost('video', { ...base, hideImageOnly: false }), true);
});
