/**
 * Reading-time tracking for the daily digest. Uses only viewport signals (no
 * hover) so it also works on touch devices: a post counts as being read while
 * >= 60% of it is on screen (or it fills most of the viewport), the tab is
 * visible, the window is focused and the user was active in the last 30s.
 *
 * Dwell is accumulated by the pure dwell-accumulator and flushed to the
 * background every ~10s and when the page is hidden or closed.
 */

import { MESSAGE_TYPES } from '../shared/constants.js';
import {
  DWELL_FLUSH_INTERVAL_MS,
  DWELL_IDLE_MS,
  DWELL_VISIBLE_RATIO,
} from '../shared/digest-constants.js';
import { logger } from '../shared/logger.js';
import { isExtensionValid, sendMessage } from '../shared/messaging.js';
import { createDwellAccumulator } from './dwell-accumulator.js';
import { extractReadablePost } from './post-extractor.js';
import { findTweetElements } from './tweet-extractor.js';

const SCAN_DELAY_MS = 300;
const ACTIVITY_EVENTS = ['scroll', 'wheel', 'mousemove', 'keydown', 'pointerdown', 'touchstart'];
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

const isPageActive = () => document.visibilityState === 'visible' && document.hasFocus();

export function createDwellTracker() {
  const accumulator = createDwellAccumulator({ idleMs: DWELL_IDLE_MS });
  /** Post element -> id it was last counted under (X recycles DOM nodes). */
  const countedAs = new Map();
  let observer = null;
  let mutationObserver = null;
  let flushTimer = null;
  let scanTimer = null;
  let running = false;

  /** A post counts as read when mostly visible, or when it fills the viewport. */
  function isReadable(entry) {
    if (!entry.isIntersecting) return false;
    const viewportHeight = entry.rootBounds?.height ?? window.innerHeight;
    return (
      entry.intersectionRatio >= DWELL_VISIBLE_RATIO ||
      entry.intersectionRect.height >= viewportHeight * DWELL_VISIBLE_RATIO
    );
  }

  function release(element, t) {
    const id = countedAs.get(element);
    if (id === undefined) return;
    countedAs.delete(element);
    accumulator.setVisible(id, false, t);
  }

  function handleEntries(entries) {
    const t = Date.now();
    for (const entry of entries) {
      const element = entry.target;
      if (!element.isConnected || !isReadable(entry)) {
        release(element, t);
        continue;
      }
      const post = extractReadablePost(element);
      if (!post) {
        release(element, t);
        continue;
      }
      if (countedAs.get(element) !== post.id) release(element, t);
      countedAs.set(element, post.id);
      accumulator.setVisible(post.id, true, t, post);
    }
  }

  function scan() {
    if (!running || !observer) return;
    for (const element of findTweetElements()) observer.observe(element); // idempotent
    for (const element of [...countedAs.keys()]) {
      if (!element.isConnected) release(element, Date.now());
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, SCAN_DELAY_MS);
  }

  function flush() {
    const t = Date.now();
    const posts = accumulator.collect(t);
    if (posts.length === 0 || !isExtensionValid()) return;
    logger.debug(`Flushing dwell for ${posts.length} posts`);
    sendMessage(MESSAGE_TYPES.READING_BATCH, { posts });
  }

  const noteActivity = () => accumulator.noteActivity(Date.now());
  const syncPageActive = () => accumulator.setPageActive(isPageActive(), Date.now());

  function handleVisibilityChange() {
    syncPageActive();
    if (document.visibilityState === 'hidden') flush();
  }

  function start() {
    if (running || typeof IntersectionObserver === 'undefined') return;
    running = true;
    accumulator.setPageActive(isPageActive(), Date.now());
    observer = new IntersectionObserver(handleEntries, { threshold: THRESHOLDS });
    mutationObserver = new MutationObserver(scheduleScan);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, noteActivity, { passive: true, capture: true });
    }
    window.addEventListener('focus', syncPageActive);
    window.addEventListener('blur', syncPageActive);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    flushTimer = setInterval(flush, DWELL_FLUSH_INTERVAL_MS);
    noteActivity();
    scan();
    logger.debug('Reading tracker started');
  }

  function stop() {
    if (!running) return;
    flush();
    running = false;
    observer?.disconnect();
    mutationObserver?.disconnect();
    observer = mutationObserver = null;
    for (const name of ACTIVITY_EVENTS) {
      window.removeEventListener(name, noteActivity, { capture: true });
    }
    window.removeEventListener('focus', syncPageActive);
    window.removeEventListener('blur', syncPageActive);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', flush);
    clearInterval(flushTimer);
    clearTimeout(scanTimer);
    for (const element of [...countedAs.keys()]) release(element, Date.now());
    logger.debug('Reading tracker stopped');
  }

  return {
    /** Starts or stops tracking according to the user's digest settings. */
    configure({ digestEnabled, digestPaused }) {
      if (digestEnabled && !digestPaused) start();
      else stop();
    },
  };
}
