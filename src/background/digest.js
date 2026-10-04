/**
 * Daily digest orchestration: generates the digest of the user's reading
 * (AI-written when a Gemini key is configured, plain otherwise), schedules it
 * with chrome.alarms, notifies the user and serves it to the digest page.
 *
 * The service worker can be asleep at delivery time, so nothing relies on
 * memory: the alarm is re-armed on install/startup/settings change, and
 * `catchUpMissedDigests` generates anything an unfired alarm left behind.
 */

import { MESSAGE_TYPES, STORAGE_KEYS, SYNC_SETTING_KEYS } from '../shared/constants.js';
import {
  assembleDigest,
  buildDigestPrompt,
  parseDigestResponse,
} from '../shared/digest-builder.js';
import {
  DIGEST_ALARM_NAME,
  DIGEST_LIMITS,
  DIGEST_NOTIFICATION_PREFIX,
  DIGEST_PAGE_PATH,
} from '../shared/digest-constants.js';
import {
  isDayKey,
  isPastDeliveryTime,
  localDayKey,
  nextOccurrence,
  pruneByDay,
} from '../shared/day.js';
import { ext, hasAlarms, hasNotifications } from '../shared/browser.js';
import { requestGeminiText } from '../shared/gemini.js';
import { logger } from '../shared/logger.js';
import { rankPosts } from '../shared/ranking.js';
import { isSettingsArea, loadSettings } from '../shared/storage.js';
import { summarizeDay } from './reading-log.js';
import { readingStore } from './reading-store.js';
import { createStore } from './store.js';

const SYNC_DIGEST_KEYS = SYNC_SETTING_KEYS.filter((key) => key.startsWith('digest'));

const digestStore = createStore(
  STORAGE_KEYS.DIGESTS,
  () => ({}),
  (raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {})
);

/** In-flight generations by day, so alarm + catch-up + button never double up. */
const inFlight = new Map();

/**
 * Generates (or returns the existing) digest for a day.
 * @param {string} day
 * @param {{force?: boolean, notify?: boolean}} [options] `force` regenerates an
 *   existing digest; `notify` shows the "digest is ready" notification.
 * @returns {Promise<{digest?: object, existing?: boolean, empty?: boolean}>}
 */
export function generateDigest(day, options = {}) {
  const key = `${day}:${options.force ? 'force' : 'normal'}`;
  if (!inFlight.has(key)) {
    const run = runGeneration(day, options).finally(() => inFlight.delete(key));
    inFlight.set(key, run);
  }
  return inFlight.get(key);
}

async function runGeneration(day, { force = false, notify = false }) {
  const stored = (await digestStore.get())[day];
  if (stored && !force) return { digest: stored, existing: true };

  const log = await readingStore.get();
  const dayPosts = log[day] ?? {};
  const ranked = rankPosts(Object.values(dayPosts));
  if (ranked.length === 0) return { empty: true };

  const { apiKey } = await loadSettings();
  let ai = null;
  if (apiKey) {
    try {
      const text = await requestGeminiText(apiKey, buildDigestPrompt(ranked), {
        temperature: 0.4,
        maxOutputTokens: 1500,
      });
      ai = parseDigestResponse(text, ranked.length);
    } catch (error) {
      logger.warn('AI digest failed, using the plain digest:', error.message);
    }
  }

  const now = Date.now();
  const digest = {
    ...assembleDigest({ day, now, ranked, ai, totals: summarizeDay(dayPosts) }),
    notified: notify,
  };
  await digestStore.update((digests) =>
    pruneByDay({ ...digests, [day]: digest }, localDayKey(now), DIGEST_LIMITS.RETENTION_DAYS)
  );
  if (notify) await notifyDigestReady(digest);
  return { digest };
}

async function notifyDigestReady(digest) {
  if (!hasNotifications()) return; // Safari: the digest is surfaced when the popup opens
  try {
    await ext.notifications.create(`${DIGEST_NOTIFICATION_PREFIX}${digest.day}`, {
      type: 'basic',
      iconUrl: ext.runtime.getURL('icons/icon128.png'),
      title: 'Your XQuiz daily digest is ready',
      message: digest.overview.slice(0, 200),
    });
  } catch (error) {
    logger.warn('Could not show the digest notification:', error.message);
  }
}

/**
 * Generates digests that should already exist: any tracked day before today,
 * and today itself once the delivery time has passed.
 * @param {number} [now]
 */
export async function catchUpMissedDigests(now = Date.now()) {
  const { digestEnabled, digestTime } = await loadSettings();
  if (!digestEnabled) return;
  const today = localDayKey(now);
  const digests = await digestStore.get();
  const log = await readingStore.get();
  const due = Object.keys(log)
    .filter(
      (day) => !digests[day] && day <= today && (day < today || isPastDeliveryTime(now, digestTime))
    )
    .sort();
  for (const day of due) await generateDigest(day, { notify: true });
}

/**
 * Arms the daily alarm (or removes it when the digest is off). Safe to call
 * repeatedly; an alarm that already fires at the right time is kept.
 * @param {number} [now]
 */
export async function scheduleDigestAlarm(now = Date.now()) {
  const { digestEnabled, digestTime } = await loadSettings();
  if (!hasAlarms()) return null; // foreground catch-up (RECONCILE_DIGEST) covers delivery
  if (!digestEnabled) {
    await ext.alarms.clear(DIGEST_ALARM_NAME);
    return null;
  }
  const when = nextOccurrence(now, digestTime);
  const existing = await ext.alarms.get(DIGEST_ALARM_NAME);
  if (existing?.scheduledTime !== when) await ext.alarms.create(DIGEST_ALARM_NAME, { when });
  return when;
}

/** Alarm handler: generate today's digest (once), notify, then re-arm. */
export async function handleDigestAlarm(now = Date.now()) {
  try {
    const result = await generateDigest(localDayKey(now), { notify: true });
    // Generated on demand earlier: the user still gets the heads-up once.
    if (result.existing && !result.digest.notified) {
      await digestStore.update((digests) => ({
        ...digests,
        [result.digest.day]: { ...result.digest, notified: true },
      }));
      await notifyDigestReady(result.digest);
    }
  } finally {
    await scheduleDigestAlarm(now + 1000);
  }
}

/** Reconciles alarm and missed digests; called on install and browser startup. */
export async function reconcileDigest() {
  await scheduleDigestAlarm();
  await catchUpMissedDigests();
}

/** Registers alarm/notification/lifecycle listeners. Call synchronously at worker start. */
export function registerDigest() {
  ext.runtime.onInstalled.addListener(() => reconcileDigest().catch(logFailure));
  ext.runtime.onStartup.addListener(() => reconcileDigest().catch(logFailure));
  reconcileDigest().catch(logFailure); // every worker wake-up: re-arm the alarm, catch up

  if (hasAlarms()) {
    ext.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === DIGEST_ALARM_NAME) handleDigestAlarm().catch(logFailure);
    });
  }

  if (hasNotifications()) {
    ext.notifications.onClicked.addListener((notificationId) => {
      if (!notificationId.startsWith(DIGEST_NOTIFICATION_PREFIX)) return;
      const day = notificationId.slice(DIGEST_NOTIFICATION_PREFIX.length);
      openDigestPage(day).catch(logFailure);
      ext.notifications.clear(notificationId);
    });
  }

  ext.storage.onChanged.addListener((changes, area) => {
    if (isSettingsArea(area) && SYNC_DIGEST_KEYS.some((key) => key in changes)) {
      reconcileDigest().catch(logFailure);
    }
  });
}

const logFailure = (error) => logger.error('Digest task failed:', error?.message ?? error);

export function openDigestPage(day) {
  const url = ext.runtime.getURL(`${DIGEST_PAGE_PATH}${isDayKey(day) ? `?day=${day}` : ''}`);
  return ext.tabs.create({ url });
}

/** Days that have a stored digest, newest first. */
async function listDigestDays() {
  return Object.keys(await digestStore.get())
    .filter(isDayKey)
    .sort()
    .reverse();
}

export const messageHandlers = {
  [MESSAGE_TYPES.GET_DIGEST]: async (message) => {
    const day = isDayKey(message.day) ? message.day : localDayKey();
    return { day, digest: (await digestStore.get())[day] ?? null };
  },

  /**
   * Foreground catch-up: popup and content script ask for this when they
   * load, so a digest that is due gets built even if no alarm or notification
   * could wake the worker (Safari).
   */
  [MESSAGE_TYPES.RECONCILE_DIGEST]: async () => {
    await reconcileDigest();
    return { success: true };
  },

  [MESSAGE_TYPES.LIST_DIGEST_DAYS]: async () => ({ days: await listDigestDays() }),

  [MESSAGE_TYPES.GENERATE_DIGEST]: async (message) => {
    const day = isDayKey(message.day) ? message.day : localDayKey();
    const result = await generateDigest(day, { force: true });
    return { day, digest: result.digest ?? null, empty: Boolean(result.empty) };
  },

  [MESSAGE_TYPES.CLEAR_READING_DATA]: async () => {
    await Promise.all([readingStore.set({}), digestStore.set({})]);
    return { success: true };
  },
};
