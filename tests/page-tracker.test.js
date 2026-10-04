import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isOnTrackedPage, isProfilePath } from '../src/content/page-tracker.js';

test('isProfilePath accepts handles and nested profile routes', () => {
  assert.equal(isProfilePath('/jack'), true);
  assert.equal(isProfilePath('/Jack_99/status/123'), true);
  assert.equal(isProfilePath('/a'), true);
});

test('isProfilePath rejects the root, app routes and invalid handles', () => {
  assert.equal(isProfilePath('/'), false);
  assert.equal(isProfilePath(''), false);
  assert.equal(isProfilePath('/home'), false);
  assert.equal(isProfilePath('/Settings'), false);
  assert.equal(isProfilePath('/i/flow/login'), false);
  assert.equal(isProfilePath('/this_handle_is_too_long'), false);
  assert.equal(isProfilePath('/bad-handle'), false);
});

test('isOnTrackedPage honours the home setting', () => {
  assert.equal(isOnTrackedPage('/', ['home']), true);
  assert.equal(isOnTrackedPage('/home', ['home']), true);
  assert.equal(isOnTrackedPage('/home', []), false);
  assert.equal(isOnTrackedPage('/jack', ['home']), false);
});

test('isOnTrackedPage honours the profiles setting', () => {
  assert.equal(isOnTrackedPage('/jack', ['profiles']), true);
  assert.equal(isOnTrackedPage('/jack/status/1', new Set(['profiles'])), true);
  assert.equal(isOnTrackedPage('/home', ['profiles']), false);
  assert.equal(isOnTrackedPage('/explore', ['home', 'profiles']), false);
});

test('isOnTrackedPage treats an empty pathname as the root', () => {
  assert.equal(isOnTrackedPage('', ['home']), true);
});
