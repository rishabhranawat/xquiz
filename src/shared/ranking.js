/**
 * Intent ranking (pure). Dwell time is a proxy for interest, but raw time is
 * misleading: a long post needs longer to read than a one-liner. Each post's
 * dwell is therefore compared with its expected reading time.
 */

export const READING_WPM = 238;
export const MIN_DWELL_MS = 1500; // shorter is a scroll-past, not reading
export const MAX_DWELL_MS = 180_000; // longer is probably the user walking away
export const MIN_EXPECTED_MS = 2000; // floor for very short posts
export const MAX_COMPLETION = 1.5; // reading "more than fully" adds nothing
export const REVISIT_BONUS = 0.2; // per extra visit
export const MAX_REVISIT_BONUS_VISITS = 3;
export const TOP_N = 10;

/** @param {string} text */
export function countWords(text) {
  return String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Time a typical reader needs for the text, in ms (at least MIN_EXPECTED_MS). */
export function expectedReadingMs(text) {
  return Math.max((countWords(text) / READING_WPM) * 60_000, MIN_EXPECTED_MS);
}

/**
 * Intent score of one post; 0 when the dwell was too short to be reading.
 * score = completion * sqrt(seconds) * revisit multiplier, where completion
 * is dwell / expected reading time (capped). The sqrt keeps a long, properly
 * read post ahead of a short post that was merely glanced at for a while.
 * @param {{text: string, dwellMs: number, visits?: number}} post
 * @returns {number}
 */
export function intentScore(post) {
  const dwell = Number(post?.dwellMs);
  if (!Number.isFinite(dwell) || dwell < MIN_DWELL_MS) return 0;
  const effective = Math.min(dwell, MAX_DWELL_MS);
  const completion = Math.min(effective / expectedReadingMs(post.text), MAX_COMPLETION);
  const extraVisits = Math.min(Math.max((post.visits ?? 1) - 1, 0), MAX_REVISIT_BONUS_VISITS);
  return completion * Math.sqrt(effective / 1000) * (1 + REVISIT_BONUS * extraVisits);
}

/**
 * Top posts by intent score (highest first), without the posts that scored 0.
 * Ties go to the most recently seen post.
 * @template {{text: string, dwellMs: number, visits?: number, lastSeen?: number}} P
 * @param {P[]} posts
 * @param {number} [limit]
 * @returns {(P & {score: number})[]}
 */
export function rankPosts(posts, limit = TOP_N) {
  return posts
    .map((post) => ({ ...post, score: intentScore(post) }))
    .filter((post) => post.score > 0)
    .sort((a, b) => b.score - a.score || (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
    .slice(0, limit);
}
