// Safari has no side panel or notifications API: the background modules must
// load and run without them, and still build a due digest on demand.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

const load = (path) => import(`${path}?safari=${Math.random()}`);

let local;
let listeners;

beforeEach(() => {
  local = {};
  listeners = [];
  const area = (store) => ({
    get: async (keys) => {
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
    },
    set: async (items) => Object.assign(store, structuredClone(items)),
    remove: async () => {},
  });
  const event = { addListener: (fn) => listeners.push(fn) };
  // Deliberately no sidePanel, notifications or alarms.
  globalThis.browser = {
    runtime: { id: 'self', onInstalled: event, onStartup: event, onMessage: event },
    storage: { local: area(local), sync: area({}), onChanged: event },
    tabs: { onUpdated: event, onActivated: event },
    action: { onClicked: event },
  };
});

afterEach(() => {
  delete globalThis.browser;
});

test('registerSidePanel does nothing without a side panel', async () => {
  const { registerSidePanel } = await load('../src/background/side-panel.js');
  registerSidePanel();
  assert.equal(listeners.length, 0);
});

test('OPEN_SIDE_PANEL reports unsupported instead of throwing', async () => {
  const { messageHandlers } = await load('../src/background/side-panel.js');
  const response = await messageHandlers.OPEN_SIDE_PANEL({}, { tab: { id: 1 } });
  assert.equal(response.success, false);
  assert.equal(response.unsupported, true);
});

test('digest registration, alarm scheduling and RECONCILE_DIGEST work without alarms or notifications', async () => {
  const digest = await load('../src/background/digest.js');
  digest.registerDigest();
  assert.equal(await digest.scheduleDigestAlarm(), null);
  const response = await digest.messageHandlers.RECONCILE_DIGEST({});
  assert.deepEqual(response, { success: true });
});
