/**
 * Pure logic for the per-day reading log: validating posts sent by content
 * scripts, aggregating dwell by post id, capping and retention. Persistence
 * and messaging live in reading-store.js.
 *
 * Shape: `{ [dayKey]: { [postId]: Post } }` where
 * Post = { id, author, displayName, text, url, hasMedia, dwellMs, visits, firstSeen, lastSeen }.
 */

import { DIGEST_LIMITS } from '../shared/digest-constants.js';
import { pruneByDay } from '../shared/day.js';

const HANDLE_PATTERN = /^\w{1,15}$/;
const STATUS_ID_PATTERN = /^\d{5,25}$/;
/** Ceiling for one batch entry: a flush interval is ~10s, so this is generous. */
const MAX_DWELL_PER_BATCH_MS = 10 * 60_000;

const asString = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '');
const asTimestamp = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;

/**
 * Canonical permalink for a post. Built from validated parts, never taken
 * from the page, so a hostile page cannot smuggle in another URL.
 * @param {string} author
 * @param {string} id
 * @returns {string | null}
 */
export function buildPostUrl(author, id) {
  if (!HANDLE_PATTERN.test(author)) return null;
  return STATUS_ID_PATTERN.test(id)
    ? `https://x.com/${author}/status/${id}`
    : `https://x.com/${author}`;
}

/**
 * Validates one untrusted post from a content script. Returns null for ads,
 * text-less posts and malformed entries.
 * @param {any} raw
 * @param {number} now epoch ms, used when timestamps are missing
 */
export function sanitizePost(raw, now) {
  if (!raw || typeof raw !== 'object' || raw.promoted === true) return null;
  const id = asString(raw.id, 64);
  const text = asString(raw.text, DIGEST_LIMITS.MAX_TEXT_LENGTH).trim();
  const dwellMs = Number(raw.dwellMs);
  if (!id || !text || !Number.isFinite(dwellMs) || dwellMs <= 0) return null;

  const author = asString(raw.author, 32).replace(/^@/, '') || 'unknown';
  const lastSeen = asTimestamp(raw.lastSeen, now);
  return {
    id,
    author,
    displayName: asString(raw.displayName, 80) || author,
    text,
    url: buildPostUrl(author, id),
    hasMedia: Boolean(raw.hasMedia),
    dwellMs: Math.min(Math.round(dwellMs), MAX_DWELL_PER_BATCH_MS),
    visits: Math.min(Math.max(Math.floor(Number(raw.visits)) || 1, 1), 20),
    firstSeen: asTimestamp(raw.firstSeen, lastSeen),
    lastSeen,
  };
}

/**
 * Keeps the `max` posts with the most dwell (stable for ties: newest first).
 * @param {Record<string, object>} posts
 * @param {number} max
 */
export function capPosts(posts, max = DIGEST_LIMITS.MAX_POSTS_PER_DAY) {
  const entries = Object.entries(posts);
  if (entries.length <= max) return posts;
  entries.sort(([, a], [, b]) => b.dwellMs - a.dwellMs || b.lastSeen - a.lastSeen);
  return Object.fromEntries(entries.slice(0, max));
}

/**
 * Adds a batch of sanitized posts to one day's posts: dwell and visits add
 * up per id, first/last seen widen, text is refreshed. Returns a new object.
 * @param {Record<string, object>} dayPosts
 * @param {object[]} batch sanitized posts
 * @param {number} [max]
 */
export function mergePosts(dayPosts, batch, max = DIGEST_LIMITS.MAX_POSTS_PER_DAY) {
  const merged = { ...dayPosts };
  for (const post of batch) {
    const existing = merged[post.id];
    merged[post.id] = existing
      ? {
          ...existing,
          text: post.text,
          displayName: post.displayName,
          hasMedia: existing.hasMedia || post.hasMedia,
          dwellMs: existing.dwellMs + post.dwellMs,
          visits: existing.visits + post.visits,
          firstSeen: Math.min(existing.firstSeen, post.firstSeen),
          lastSeen: Math.max(existing.lastSeen, post.lastSeen),
        }
      : post;
  }
  return capPosts(merged, max);
}

/**
 * Adds a raw (untrusted) batch to the log under `dayKey`, drops days outside
 * the retention window and returns the new log.
 * @param {Record<string, Record<string, object>>} log
 * @param {any[]} rawPosts
 * @param {string} dayKey the local day the batch belongs to
 * @param {number} now epoch ms
 */
export function addBatchToLog(log, rawPosts, dayKey, now) {
  const batch = (Array.isArray(rawPosts) ? rawPosts : [])
    .slice(0, DIGEST_LIMITS.MAX_BATCH_POSTS)
    .map((raw) => sanitizePost(raw, now))
    .filter(Boolean);
  const pruned = pruneByDay(log, dayKey, DIGEST_LIMITS.RETENTION_DAYS);
  if (batch.length === 0) return pruned;
  return { ...pruned, [dayKey]: mergePosts(pruned[dayKey] ?? {}, batch) };
}

/** Normalizes whatever was persisted into a log object. */
export function normalizeLog(raw) {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/**
 * Totals for one day's posts (all tracked posts, not only the top ones).
 * @param {Record<string, {dwellMs: number}> | undefined} dayPosts
 */
export function summarizeDay(dayPosts) {
  const posts = Object.values(dayPosts ?? {});
  return { postCount: posts.length, totalDwellMs: posts.reduce((sum, p) => sum + p.dwellMs, 0) };
}
