// Exercises the digest service worker modules against an in-memory fake of
// the chrome.* APIs: ingestion, generation (AI and fallback), alarms and
// catch-up after a missed alarm.

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { readingStore as sharedReadingStore } from '../src/background/reading-store.js';
import { localDayKey, shiftDay } from '../src/shared/day.js';

let local;
let sync;
let alarms;
let notifications;
let tabs;

function installFakeChrome() {
  local = {};
  sync = {};
  alarms = new Map();
  notifications = [];
  tabs = [];
  const read = (store) => async (keys) => {
    const list = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
  };
  globalThis.chrome = {
    runtime: { id: 'self', getURL: (path) => `chrome-extension://self/${path}` },
    storage: {
      local: {
        get: read(local),
        set: async (items) => Object.assign(local, structuredClone(items)),
      },
      sync: { get: read(sync), set: async (items) => Object.assign(sync, items) },
    },
    alarms: {
      get: async (name) => alarms.get(name),
      create: async (name, info) => alarms.set(name, { name, scheduledTime: info.when }),
      clear: async (name) => alarms.delete(name),
    },
    notifications: { create: async (id, options) => notifications.push({ id, options }) },
    tabs: { create: async (options) => tabs.push(options) },
  };
}

/** Fresh module instances simulate a restarted service worker. */
const load = (path) => import(`${path}?restart=${Math.random()}`);

const NOW = new Date(2026, 0, 10, 22, 0).getTime(); // 10 Jan, after the 9 PM default
const TODAY = localDayKey(NOW);

const post = (id, dwellMs, text = `A reasonably interesting post number ${id} about things.`) => ({
  id: `18000000000${String(id).padStart(6, '0')}`,
  author: 'jack',
  displayName: 'Jack',
  text,
  dwellMs,
  visits: 1,
  hasMedia: false,
  firstSeen: NOW - 1000,
  lastSeen: NOW,
});

/** Writes a reading log directly (as persisted by the reading store). */
async function seedLog(day, posts) {
  local.readingLog = {
    ...local.readingLog,
    [day]: Object.fromEntries(
      posts.map((p) => [p.id, { ...p, url: `https://x.com/jack/status/${p.id}` }])
    ),
  };
  await sharedReadingStore.set(local.readingLog);
}

function mockGemini(payload, { ok = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return {
      ok,
      json: async () =>
        ok
          ? { candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }
          : { error: { message: 'quota' } },
    };
  };
  return calls;
}

const realNow = Date.now;
beforeEach(async () => {
  Date.now = () => NOW;
  installFakeChrome();
  await sharedReadingStore.set({}); // digest.js imports this (cached) instance
  delete local.readingLog;
});
afterEach(() => {
  Date.now = realNow;
});

test('READING_BATCH records dwell only after the user opted in', async () => {
  const { messageHandlers } = await load('../src/background/reading-store.js');
  const batch = { posts: [post(1, 5000)] };

  assert.deepEqual(await messageHandlers.READING_BATCH(batch), { success: false, tracking: false });
  assert.equal(local.readingLog, undefined);

  sync.digestEnabled = true;
  sync.digestPaused = true;
  assert.equal((await messageHandlers.READING_BATCH(batch)).success, false);

  sync.digestPaused = false;
  assert.equal((await messageHandlers.READING_BATCH(batch)).success, true);
  await messageHandlers.READING_BATCH(batch);
  const stored = Object.values(local.readingLog[localDayKey()]);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].dwellMs, 10_000); // aggregated across batches
  assert.equal((await messageHandlers.GET_READING_STATUS()).today.postCount, 1);
});

test('reading data survives a service worker restart', async () => {
  sync.digestEnabled = true;
  const first = await load('../src/background/reading-store.js');
  await first.messageHandlers.READING_BATCH({ posts: [post(1, 4000)] });
  const second = await load('../src/background/reading-store.js');
  assert.equal((await second.messageHandlers.GET_READING_STATUS()).today.postCount, 1);
});

test('generates an AI digest of the top 10 using the stored API key', async () => {
  local.apiKey = 'SECRET';
  await seedLog(
    TODAY,
    Array.from({ length: 14 }, (_, i) => post(i, 5000 + i * 2000))
  );
  const calls = mockGemini({
    overview: 'You read about many things.',
    takeaways: Array.from({ length: 10 }, (_, i) => ({
      index: i + 1,
      takeaway: `AI take ${i + 1}`,
    })),
  });

  const { generateDigest } = await load('../src/background/digest.js');
  const { digest } = await generateDigest(TODAY);
  assert.equal(digest.source, 'ai');
  assert.equal(digest.items.length, 10);
  assert.equal(digest.items[0].takeaway, 'AI take 1');
  assert.equal(digest.postCount, 14);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'SECRET');
  assert.equal(
    JSON.parse(calls[0].init.body).generationConfig.responseMimeType,
    'application/json'
  );
  assert.deepEqual(Object.keys(local.digests), [TODAY]);
});

test('falls back to a plain digest without an API key (no network call)', async () => {
  await seedLog(TODAY, [post(1, 9000), post(2, 20_000)]);
  globalThis.fetch = async () => assert.fail('must not call the network');
  const { generateDigest } = await load('../src/background/digest.js');
  const { digest } = await generateDigest(TODAY);
  assert.equal(digest.source, 'fallback');
  assert.equal(digest.items[0].id, post(2, 0).id);
  assert.match(digest.items[0].takeaway, /^A reasonably interesting post number 2/);
});

test('falls back when the AI call fails or returns garbage', async () => {
  local.apiKey = 'k';
  await seedLog(TODAY, [post(1, 9000)]);
  const { generateDigest } = await load('../src/background/digest.js');

  mockGemini({}, { ok: false });
  assert.equal((await generateDigest(TODAY, { force: true })).digest.source, 'fallback');

  mockGemini({ overview: '' });
  assert.equal((await generateDigest(TODAY, { force: true })).digest.source, 'fallback');
});

test('an existing digest is reused unless forced; empty days produce nothing', async () => {
  await seedLog(TODAY, [post(1, 9000)]);
  const { generateDigest } = await load('../src/background/digest.js');
  const first = await generateDigest(TODAY);
  assert.ok(!first.existing);
  const again = await generateDigest(TODAY);
  assert.ok(again.existing);
  assert.equal(again.digest.generatedAt, first.digest.generatedAt);

  const empty = await generateDigest(shiftDay(TODAY, -1));
  assert.deepEqual(empty, { empty: true });
  assert.equal(local.digests[shiftDay(TODAY, -1)], undefined);
});

test('glances shorter than 1.5s never make the digest', async () => {
  await seedLog(TODAY, [post(1, 1000), post(2, 1400)]);
  const { generateDigest } = await load('../src/background/digest.js');
  assert.deepEqual(await generateDigest(TODAY), { empty: true });
});

test('concurrent generation requests share one run', async () => {
  local.apiKey = 'k';
  await seedLog(TODAY, [post(1, 9000)]);
  const calls = mockGemini({ overview: 'ok', takeaways: [] });
  const { generateDigest } = await load('../src/background/digest.js');
  await Promise.all([generateDigest(TODAY), generateDigest(TODAY)]);
  assert.equal(calls.length, 1);
});

test('digests older than 7 days are purged when a new one is saved', async () => {
  const old = shiftDay(TODAY, -9);
  local.digests = { [old]: { day: old, items: [] }, [shiftDay(TODAY, -2)]: { day: 'keep' } };
  await seedLog(TODAY, [post(1, 9000)]);
  const { generateDigest } = await load('../src/background/digest.js');
  await generateDigest(TODAY, { force: true });
  assert.ok(!(old in local.digests));
  assert.ok(shiftDay(TODAY, -2) in local.digests);
});

test('alarm: scheduled at the delivery time, replaced on change, removed when disabled', async () => {
  const { scheduleDigestAlarm } = await load('../src/background/digest.js');
  assert.equal(await scheduleDigestAlarm(NOW), null); // off by default
  assert.equal(alarms.size, 0);

  sync.digestEnabled = true;
  const morning = new Date(2026, 0, 10, 8, 0).getTime();
  await scheduleDigestAlarm(morning);
  assert.equal(
    alarms.get('xquiz-daily-digest').scheduledTime,
    new Date(2026, 0, 10, 21, 0).getTime()
  );

  sync.digestTime = '06:30';
  await scheduleDigestAlarm(morning);
  assert.equal(
    alarms.get('xquiz-daily-digest').scheduledTime,
    new Date(2026, 0, 11, 6, 30).getTime()
  );

  sync.digestEnabled = false;
  await scheduleDigestAlarm(morning);
  assert.equal(alarms.size, 0);
});

test('alarm fire: generates once, notifies, re-arms; skips a digest already generated', async () => {
  sync.digestEnabled = true;
  await seedLog(TODAY, [post(1, 9000)]);
  const { handleDigestAlarm } = await load('../src/background/digest.js');

  await handleDigestAlarm(NOW);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].options.title, 'Your XQuiz daily digest is ready');
  assert.equal(notifications[0].id, `xquiz-digest-${TODAY}`);
  assert.ok(alarms.get('xquiz-daily-digest').scheduledTime > NOW);
  const generatedAt = local.digests[TODAY].generatedAt;

  await handleDigestAlarm(NOW + 5000); // second fire: already done and already notified
  assert.equal(notifications.length, 1);
  assert.equal(local.digests[TODAY].generatedAt, generatedAt);
});

test('alarm fire after an on-demand digest still sends the notification once', async () => {
  sync.digestEnabled = true;
  await seedLog(TODAY, [post(1, 9000)]);
  const { generateDigest, handleDigestAlarm } = await load('../src/background/digest.js');
  await generateDigest(TODAY); // on demand, no notification
  await handleDigestAlarm(NOW);
  await handleDigestAlarm(NOW + 1000);
  assert.equal(notifications.length, 1);
});

test('alarm fire with nothing read does not notify', async () => {
  sync.digestEnabled = true;
  const { handleDigestAlarm } = await load('../src/background/digest.js');
  await handleDigestAlarm(NOW);
  assert.equal(notifications.length, 0);
  assert.ok(alarms.has('xquiz-daily-digest'));
});

test('catch-up generates missed digests: past days always, today only after delivery time', async () => {
  sync.digestEnabled = true;
  const yesterday = shiftDay(TODAY, -1);
  await seedLog(yesterday, [post(1, 9000)]);
  await seedLog(TODAY, [post(2, 9000)]);
  const { catchUpMissedDigests } = await load('../src/background/digest.js');

  const beforeDelivery = new Date(2026, 0, 10, 8, 0).getTime();
  await catchUpMissedDigests(beforeDelivery);
  assert.deepEqual(Object.keys(local.digests), [yesterday]);
  assert.equal(notifications.length, 1);

  await catchUpMissedDigests(NOW);
  assert.deepEqual(Object.keys(local.digests).sort(), [yesterday, TODAY].sort());
  assert.equal(notifications.length, 2);

  await catchUpMissedDigests(NOW); // idempotent
  assert.equal(notifications.length, 2);
});

test('catch-up does nothing while the digest is disabled', async () => {
  await seedLog(shiftDay(TODAY, -1), [post(1, 9000)]);
  const { catchUpMissedDigests } = await load('../src/background/digest.js');
  await catchUpMissedDigests(NOW);
  assert.equal(local.digests, undefined);
});

test('message handlers: get, list, generate and clear', async () => {
  await seedLog(TODAY, [post(1, 9000)]);
  const { messageHandlers } = await load('../src/background/digest.js');

  assert.equal((await messageHandlers.GET_DIGEST({ day: TODAY })).digest, null);
  const generated = await messageHandlers.GENERATE_DIGEST({ day: TODAY });
  assert.equal(generated.digest.items.length, 1);
  assert.equal((await messageHandlers.GET_DIGEST({ day: TODAY })).digest.day, TODAY);
  assert.deepEqual((await messageHandlers.LIST_DIGEST_DAYS()).days, [TODAY]);
  assert.equal((await messageHandlers.GENERATE_DIGEST({ day: 'bogus' })).day, localDayKey());

  await messageHandlers.CLEAR_READING_DATA();
  assert.deepEqual(local.readingLog, {});
  assert.deepEqual(local.digests, {});
});

test('opening the digest page validates the day', async () => {
  const { openDigestPage } = await load('../src/background/digest.js');
  await openDigestPage('2026-01-10');
  await openDigestPage('<script>');
  assert.equal(tabs[0].url, 'chrome-extension://self/digest/index.html?day=2026-01-10');
  assert.equal(tabs[1].url, 'chrome-extension://self/digest/index.html');
});
