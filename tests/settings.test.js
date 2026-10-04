import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/shared/constants.js';
import { normalizeSettings } from '../src/shared/settings.js';

test('normalizeSettings returns the defaults for empty input', () => {
  const expected = { ...DEFAULT_SETTINGS, allowedPages: [...DEFAULT_SETTINGS.allowedPages] };
  assert.deepEqual(normalizeSettings(undefined), expected);
  assert.deepEqual(normalizeSettings({}), expected);
  assert.deepEqual(normalizeSettings(null), expected);
});

test('normalizeSettings keeps valid values', () => {
  const settings = {
    tweetsPerQuiz: 8,
    apiKey: 'key',
    removeVideos: true,
    viewTimeMs: 4000,
    allowedPages: ['home', 'profiles'],
  };
  assert.deepEqual(normalizeSettings(settings), settings);
});

test('normalizeSettings clamps numbers to their limits and rounds them', () => {
  assert.equal(normalizeSettings({ tweetsPerQuiz: 1 }).tweetsPerQuiz, 3);
  assert.equal(normalizeSettings({ tweetsPerQuiz: 99 }).tweetsPerQuiz, 10);
  assert.equal(normalizeSettings({ tweetsPerQuiz: '7' }).tweetsPerQuiz, 7);
  assert.equal(normalizeSettings({ viewTimeMs: 10 }).viewTimeMs, 1000);
  assert.equal(normalizeSettings({ viewTimeMs: 60000 }).viewTimeMs, 6000);
});

test('normalizeSettings falls back for non-numeric or zero numbers', () => {
  assert.equal(normalizeSettings({ tweetsPerQuiz: 'abc' }).tweetsPerQuiz, 5);
  assert.equal(normalizeSettings({ viewTimeMs: 0 }).viewTimeMs, 2000);
  assert.equal(normalizeSettings({ viewTimeMs: NaN }).viewTimeMs, 2000);
});

test('normalizeSettings sanitizes pages: unknown dropped, empty defaults to home', () => {
  assert.deepEqual(
    normalizeSettings({ allowedPages: ['profiles', 'bogus', 'profiles'] }).allowedPages,
    ['profiles']
  );
  assert.deepEqual(normalizeSettings({ allowedPages: [] }).allowedPages, ['home']);
  assert.deepEqual(normalizeSettings({ allowedPages: ['bogus'] }).allowedPages, ['home']);
  assert.deepEqual(normalizeSettings({ allowedPages: 'home' }).allowedPages, ['home']);
});

test('normalizeSettings coerces flags and trims the API key', () => {
  assert.equal(normalizeSettings({ removeVideos: 1 }).removeVideos, true);
  assert.equal(normalizeSettings({ removeVideos: undefined }).removeVideos, false);
  assert.equal(normalizeSettings({ apiKey: '  abc  ' }).apiKey, 'abc');
  assert.equal(normalizeSettings({ apiKey: 42 }).apiKey, '');
});

test('normalizeSettings does not share the default pages array', () => {
  const settings = normalizeSettings({});
  settings.allowedPages.push('profiles');
  assert.deepEqual(normalizeSettings({}).allowedPages, ['home']);
});
