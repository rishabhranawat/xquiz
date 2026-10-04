/**
 * Attention tracking: a tweet only counts as "read" after the pointer has
 * stayed over it for the configured time.
 */

const HOVER_SHADOW = 'inset 0 0 0 2px rgba(59, 130, 246, 0.3)';
const COUNTED_SHADOW = 'inset 0 0 0 2px rgba(34, 197, 94, 0.5)';
const COUNTED_FLASH_MS = 500;

/**
 * @param {object} options
 * @param {() => boolean} options.isActive Whether tracking is currently enabled.
 * @param {() => number} options.getRequiredViewMs Hover time needed to count a tweet.
 * @param {(tweetElement: Element) => void} options.onTweetRead Called once per counted tweet.
 */
export function createAttentionTracker({ isActive, getRequiredViewMs, onTweetRead }) {
  /** Tweets currently being hovered: element -> timeout id. */
  const timers = new Map();
  /** Tweets that already have listeners attached. */
  const observed = new WeakSet();

  const clearHighlight = (element) => {
    element.style.boxShadow = 'none';
  };

  function handleMouseEnter(event) {
    const element = event.currentTarget;
    if (!isActive() || timers.has(element)) return;

    element.style.transition = 'box-shadow 0.3s ease';
    element.style.boxShadow = HOVER_SHADOW;

    const timeoutId = setTimeout(() => {
      timers.delete(element);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);

      element.style.boxShadow = COUNTED_SHADOW; // flash green to show it counted
      setTimeout(() => clearHighlight(element), COUNTED_FLASH_MS);

      onTweetRead(element);
    }, getRequiredViewMs());

    timers.set(element, timeoutId);
  }

  function handleMouseLeave(event) {
    const element = event.currentTarget;
    if (!timers.has(element)) return;
    clearTimeout(timers.get(element));
    timers.delete(element);
    clearHighlight(element);
  }

  return {
    /** True if the element already has hover listeners. */
    isObserving: (element) => observed.has(element),

    /** Starts watching a tweet element for hover. */
    observe(element) {
      observed.add(element);
      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
    },

    /** Cancels all pending hover timers (e.g. when leaving a tracked page). */
    cancelAll() {
      for (const [element, timeoutId] of timers) {
        clearTimeout(timeoutId);
        clearHighlight(element);
      }
      timers.clear();
    },
  };
}
