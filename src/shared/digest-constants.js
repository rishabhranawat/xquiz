/**
 * Constants for the daily reading digest. Side-effect free, like constants.js.
 */

export const DIGEST_LIMITS = Object.freeze({
  /** Posts kept per local day (lowest dwell is dropped first). */
  MAX_POSTS_PER_DAY: 500,
  /** Days of reading data and digests kept (today included). */
  RETENTION_DAYS: 7,
  /** Characters of post text stored. */
  MAX_TEXT_LENGTH: 500,
  /** Characters of post text shown in the non-AI takeaway. */
  FALLBACK_TAKEAWAY_LENGTH: 140,
  MAX_OVERVIEW_LENGTH: 600,
  MAX_TAKEAWAY_LENGTH: 220,
  /** Posts accepted in one READING_BATCH message. */
  MAX_BATCH_POSTS: 100,
});

export const DIGEST_ALARM_NAME = 'xquiz-daily-digest';
export const DIGEST_NOTIFICATION_PREFIX = 'xquiz-digest-';
export const DIGEST_PAGE_PATH = 'digest/index.html';

/** How often the content script sends accumulated dwell to the background. */
export const DWELL_FLUSH_INTERVAL_MS = 10_000;
/** No scroll/mouse/key/touch for this long pauses dwell accumulation. */
export const DWELL_IDLE_MS = 30_000;
/** Fraction of a post that must be visible to count as being read. */
export const DWELL_VISIBLE_RATIO = 0.6;
