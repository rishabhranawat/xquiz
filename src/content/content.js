/**
 * XQuiz content script (entry point, runs on x.com / twitter.com).
 *
 * Wires together the content modules: watches the feed for tweets, counts the
 * ones the user actually reads (attention-tracker), batches them
 * (tweet-collector) and hands each full batch to the background for quiz
 * generation. To add a feature, create a module and initialise it in `init()`.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import { isExtensionValid, listenForMessages, sendMessage } from '../shared/messaging.js';
import { normalizeSettings } from '../shared/settings.js';
import { loadSyncedSettings, onSyncedSettingsChanged } from '../shared/storage.js';
import { createAttentionTracker } from './attention-tracker.js';
import { createAutoOpen } from './auto-open.js';
import { createDwellTracker } from './dwell-tracker.js';
import { setVideosHidden, tweetContainsVideo } from './distraction.js';
import { isOnTrackedPage, watchNavigation } from './page-tracker.js';
import {
  createStatusIndicator,
  ensureStatusIndicator,
  removeStatusIndicator,
  updateStatusIndicator,
} from './status-indicator.js';
import { createTweetCollector } from './tweet-collector.js';
import {
  extractTweetData,
  findTweetElements,
  isQuizWorthyText,
  readTweetFingerprint,
} from './tweet-extractor.js';

const MUTATION_SCAN_DELAY_MS = 300;
const SCROLL_SCAN_DELAY_MS = 500;
const INITIAL_SCAN_DELAY_MS = 1000;

/** Latest user settings (kept fresh via chrome.storage.onChanged). */
let settings = null;
/** Whether the current page is one the user chose to track. */
let isActive = false;

const collector = createTweetCollector();
const autoOpen = createAutoOpen();
const readingTracker = createDwellTracker(); // daily digest; off until the user opts in
const attention = createAttentionTracker({
  isActive: () => isActive,
  getRequiredViewMs: () => settings.viewTimeMs,
  onTweetRead: handleTweetRead,
});

function debounce(fn, delayMs) {
  let timeoutId;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(fn, delayMs);
  };
}

function statusState() {
  return { active: isActive, count: collector.size, total: settings.tweetsPerQuiz };
}

function sendProgress() {
  if (!isExtensionValid()) return;
  updateStatusIndicator(statusState());
  sendMessage(MESSAGE_TYPES.TWEET_PROGRESS, {
    current: collector.size,
    total: settings.tweetsPerQuiz,
  });
}

function flushTweets() {
  if (collector.size === 0 || !isExtensionValid()) return;
  const tweets = collector.drain();
  logger.debug(`Sending ${tweets.length} tweets for quiz generation`);
  sendMessage(MESSAGE_TYPES.TWEETS_COLLECTED, { tweets });
  sendProgress(); // counter is back to zero
}

function handleTweetRead(tweetElement) {
  const tweet = extractTweetData(tweetElement);
  if (!tweet || !isQuizWorthyText(tweet.text) || !collector.add(tweet)) return;

  logger.debug(`Read tweet ${collector.size}/${settings.tweetsPerQuiz} from @${tweet.author}`);
  sendProgress();
  if (collector.size >= settings.tweetsPerQuiz) flushTweets();
}

/** Re-evaluates whether the current page is tracked and updates the badge. */
function refreshActiveState() {
  const active = isOnTrackedPage(window.location.pathname, settings.allowedPages);
  if (active === isActive) return;
  isActive = active;
  updateStatusIndicator(statusState());
  logger.debug(isActive ? 'Tracking active' : 'Tracking paused');
  if (!isActive) attention.cancelAll();
}

/** Attaches hover tracking to any new, trackable tweets in the feed. */
function scanForTweets() {
  if (!isExtensionValid()) {
    logger.debug('Extension context invalidated, stopping');
    domObserver.disconnect();
    removeStatusIndicator();
    return;
  }

  ensureStatusIndicator(statusState());
  refreshActiveState();
  if (!isActive) return;

  for (const tweetElement of findTweetElements()) {
    if (attention.isObserving(tweetElement)) continue;
    if (settings.removeVideos && tweetContainsVideo(tweetElement)) continue;

    const tweet = readTweetFingerprint(tweetElement);
    if (!tweet || !isQuizWorthyText(tweet.text) || collector.hasSeen(tweet.contentHash)) continue;

    attention.observe(tweetElement);
  }
}

const scheduleMutationScan = debounce(scanForTweets, MUTATION_SCAN_DELAY_MS);
const scheduleScrollScan = debounce(scanForTweets, SCROLL_SCAN_DELAY_MS);

const domObserver = new MutationObserver((mutations) => {
  if (mutations.some((mutation) => mutation.addedNodes.length > 0)) scheduleMutationScan();
});

function applySettings(newSettings) {
  settings = newSettings;
  setVideosHidden(settings.removeVideos);
  if (isExtensionValid() && document.body) {
    readingTracker.configure(settings);
    refreshActiveState();
    updateStatusIndicator(statusState());
  }
}

async function init() {
  autoOpen.start();
  listenForMessages({ [MESSAGE_TYPES.ENABLE_AUTO_OPEN]: () => autoOpen.enable() });

  settings = await loadSyncedSettings().catch((error) => {
    logger.warn('Could not load settings, using defaults:', error.message);
    return normalizeSettings({});
  });
  setVideosHidden(settings.removeVideos);
  onSyncedSettingsChanged(applySettings);
  readingTracker.configure(settings);

  createStatusIndicator(settings.tweetsPerQuiz);
  domObserver.observe(document.querySelector('main') || document.body, {
    childList: true,
    subtree: true,
  });
  watchNavigation(scanForTweets); // X is a single-page app
  window.addEventListener('scroll', scheduleScrollScan, { passive: true });
  setTimeout(scanForTweets, INITIAL_SCAN_DELAY_MS);
  logger.debug('Content script initialised');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
