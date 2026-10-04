import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  ext,
  getApi,
  hasAlarms,
  hasNotifications,
  hasSidePanel,
  isTouchPrimary,
} from '../src/shared/browser.js';

afterEach(() => {
  delete globalThis.browser;
  delete globalThis.chrome;
});

test('prefers browser over chrome and resolves lazily', () => {
  assert.equal(getApi(), undefined);
  globalThis.chrome = { id: 'chrome' };
  assert.equal(getApi().id, 'chrome');
  globalThis.browser = { id: 'browser' };
  assert.equal(getApi().id, 'browser');
  assert.equal(ext.id, 'browser');
});

test('ext proxy reads nested APIs and is safe outside an extension', () => {
  assert.equal(ext.runtime, undefined);
  globalThis.chrome = { runtime: { id: 'abc' } };
  assert.equal(ext.runtime.id, 'abc');
});

test('feature detection reflects the available APIs', () => {
  assert.equal(hasSidePanel(), false);
  assert.equal(hasNotifications(), false);
  assert.equal(hasAlarms(), false);

  globalThis.chrome = {
    sidePanel: { open() {}, setOptions() {} },
    notifications: { create() {} },
    alarms: { create() {}, get() {} },
  };
  assert.equal(hasSidePanel(), true);
  assert.equal(hasNotifications(), true);
  assert.equal(hasAlarms(), true);
});

test('a Safari-like namespace has alarms but no side panel or notifications', () => {
  globalThis.browser = { alarms: { create() {}, get() {} }, storage: {} };
  assert.equal(hasAlarms(), true);
  assert.equal(hasSidePanel(), false);
  assert.equal(hasNotifications(), false);
});

test('isTouchPrimary uses hover/pointer media queries', () => {
  const scope = (matches) => ({ matchMedia: (q) => ({ matches: matches.includes(q) }) });
  assert.equal(isTouchPrimary(scope(['(hover: none)'])), true);
  assert.equal(isTouchPrimary(scope(['(pointer: coarse)'])), true);
  assert.equal(isTouchPrimary(scope([])), false);
  assert.equal(isTouchPrimary({}), false);
  assert.equal(
    isTouchPrimary({
      matchMedia() {
        throw new Error('nope');
      },
    }),
    false
  );
});
