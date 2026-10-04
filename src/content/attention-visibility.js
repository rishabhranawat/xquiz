/**
 * Touch-friendly attention tracking: with no hover, a tweet counts as "read"
 * once it has stayed (mostly) in the viewport, with the page visible, for the
 * configured time. Uses the same visibility rule as the digest dwell tracker.
 *
 * Same surface as the hover tracker: isObserving / observe / cancelAll.
 */

import { VISIBILITY_THRESHOLDS, isEntryVisible } from '../shared/visibility.js';

const COUNTED_SHADOW = 'inset 0 0 0 2px rgba(34, 197, 94, 0.5)';
const COUNTED_FLASH_MS = 500;

/**
 * @param {object} options
 * @param {() => boolean} options.isActive Whether tracking is currently enabled.
 * @param {() => number} options.getRequiredViewMs Visible time needed to count a tweet.
 * @param {(tweetElement: Element) => void} options.onTweetRead Called once per counted tweet.
 * @param {typeof IntersectionObserver} [options.ObserverCtor] Injectable for tests.
 * @param {Pick<Document, 'visibilityState' | 'addEventListener'>} [options.doc]
 * @param {() => number} [options.getViewportHeight]
 */
export function createVisibilityAttention({
  isActive,
  getRequiredViewMs,
  onTweetRead,
  ObserverCtor = globalThis.IntersectionObserver,
  doc = globalThis.document,
  getViewportHeight = () => globalThis.innerHeight,
}) {
  /** Elements currently visible enough: element -> timeout id (or null while paused). */
  const visible = new Map();
  /** Every element handed to observe() and not yet counted (pruned when detached). */
  const observed = new Set();
  const counted = new WeakSet();
  const pageVisible = () => doc.visibilityState === 'visible';

  const observer = new ObserverCtor(handleEntries, { threshold: [...VISIBILITY_THRESHOLDS] });

  function stopTimer(element) {
    const id = visible.get(element);
    if (id) clearTimeout(id);
    if (visible.has(element)) visible.set(element, null);
  }

  function forget(element) {
    stopTimer(element);
    visible.delete(element);
    observed.delete(element);
    observer.unobserve(element);
  }

  function startTimer(element) {
    if (!isActive() || !pageVisible() || visible.get(element)) return;
    const id = setTimeout(() => {
      forget(element);
      counted.add(element); // like the hover tracker, never count the same node twice
      element.style.transition = 'box-shadow 0.3s ease';
      element.style.boxShadow = COUNTED_SHADOW;
      setTimeout(() => {
        element.style.boxShadow = 'none';
      }, COUNTED_FLASH_MS);
      onTweetRead(element);
    }, getRequiredViewMs());
    visible.set(element, id);
  }

  function handleEntries(entries) {
    for (const element of observed) if (!element.isConnected) forget(element);
    for (const entry of entries) {
      const element = entry.target;
      if (!observed.has(element)) continue;
      if (isEntryVisible(entry, getViewportHeight())) {
        if (!visible.has(element)) visible.set(element, null);
        startTimer(element);
      } else {
        stopTimer(element);
        visible.delete(element);
      }
    }
  }

  // Backgrounded tabs must not accrue: pause on hide, resume what is still on screen.
  doc.addEventListener('visibilitychange', () => {
    for (const element of visible.keys()) {
      if (pageVisible()) startTimer(element);
      else stopTimer(element);
    }
  });

  return {
    isObserving: (element) => observed.has(element) || counted.has(element),

    observe(element) {
      observed.add(element);
      observer.observe(element);
    },

    /** Drops every pending timer and watch; the next page scan re-observes what is on screen. */
    cancelAll() {
      for (const element of [...observed]) forget(element);
    },
  };
}
