import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/shared/constants.js';
import { migrateLegacySettings, normalizeSettings } from '../src/shared/settings.js';

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
    distractionMode: true,
    hideVideos: false,
    hideImageOnly: true,
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
  assert.equal(normalizeSettings({ distractionMode: 1 }).distractionMode, true);
  assert.equal(normalizeSettings({ distractionMode: undefined }).distractionMode, false);
  assert.equal(normalizeSettings({ apiKey: '  abc  ' }).apiKey, 'abc');
  assert.equal(normalizeSettings({ apiKey: 42 }).apiKey, '');
});

test('normalizeSettings does not share the default pages array', () => {
  const settings = normalizeSettings({});
  settings.allowedPages.push('profiles');
  assert.deepEqual(normalizeSettings({}).allowedPages, ['home']);
});

test('distraction sub-options default to on and only accept booleans', () => {
  const defaults = normalizeSettings({});
  assert.equal(defaults.distractionMode, false);
  assert.equal(defaults.hideVideos, true);
  assert.equal(defaults.hideImageOnly, true);
  assert.equal(normalizeSettings({ hideVideos: false }).hideVideos, false);
  assert.equal(normalizeSettings({ hideImageOnly: false }).hideImageOnly, false);
  assert.equal(normalizeSettings({ hideVideos: 0 }).hideVideos, true);
  assert.equal(normalizeSettings({ hideImageOnly: 'no' }).hideImageOnly, true);
});

test('migrateLegacySettings turns removeVideos:true into a videos-only distraction mode', () => {
  assert.deepEqual(migrateLegacySettings({ removeVideos: true, tweetsPerQuiz: 7 }), {
    tweetsPerQuiz: 7,
    distractionMode: true,
    hideVideos: true,
    hideImageOnly: false,
  });
});

test('migrateLegacySettings drops removeVideos:false without enabling anything', () => {
  assert.deepEqual(migrateLegacySettings({ removeVideos: false, viewTimeMs: 3000 }), {
    viewTimeMs: 3000,
  });
  assert.deepEqual(migrateLegacySettings({ removeVideos: 'yes' }), {});
});

test('migrateLegacySettings lets an existing distractionMode win and never mutates', () => {
  const input = { removeVideos: true, distractionMode: false, hideImageOnly: true };
  const frozen = Object.freeze({ ...input });
  assert.deepEqual(migrateLegacySettings(frozen), { distractionMode: false, hideImageOnly: true });
  assert.deepEqual(input, { removeVideos: true, distractionMode: false, hideImageOnly: true });
});

test('migrateLegacySettings tolerates empty input and is idempotent', () => {
  assert.deepEqual(migrateLegacySettings(null), {});
  assert.deepEqual(migrateLegacySettings(undefined), {});
  const once = migrateLegacySettings({ removeVideos: true });
  assert.deepEqual(migrateLegacySettings(once), once);
});

test('normalizeSettings migrates legacy removeVideos and drops the key', () => {
  const migrated = normalizeSettings({ removeVideos: true });
  assert.equal(migrated.distractionMode, true);
  assert.equal(migrated.hideVideos, true);
  assert.equal(migrated.hideImageOnly, false);
  assert.equal('removeVideos' in migrated, false);
  assert.equal(normalizeSettings({ removeVideos: false }).distractionMode, false);
});
