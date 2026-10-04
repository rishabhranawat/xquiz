/**
 * Reads tweet data out of X's DOM. Selectors are isolated here because they
 * are the part most likely to break when X changes its markup.
 */

import { RESERVED_USER_SLUGS } from '../shared/constants.js';
import { hashTweet } from '../shared/tweet-hash.js';

const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const MIN_TWEET_LENGTH = 20;
const MIN_ALT_TEXT_LENGTH = 10;
const STATUS_ID_PATTERN = /\/status\/(\d+)/;

/** @returns {Element[]} every tweet currently rendered on the page. */
export const findTweetElements = () => [...document.querySelectorAll(TWEET_SELECTOR)];

/**
 * Extracts a user handle from a profile link such as `/jack`.
 * Returns null for non-profile links (`/jack/status/1`, `/i/flow`, `/jack?x=1`).
 * @param {string | null} href
 * @returns {string | null}
 */
export function handleFromHref(href) {
  if (!href || href.includes('?') || href.indexOf('/', 1) !== -1 || !href.startsWith('/')) {
    return null;
  }
  const handle = href.slice(1);
  return handle && !RESERVED_USER_SLUGS.includes(handle) ? handle : null;
}

/**
 * Pulls the numeric tweet id out of a status URL.
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
export function statusIdFromHref(href) {
  return href?.match(STATUS_ID_PATTERN)?.[1] ?? null;
}

/**
 * Pure rule for tweets too short or promotional to quiz on.
 * @param {string} text
 */
export function isQuizWorthyText(text) {
  return text.length >= MIN_TWEET_LENGTH && !text.startsWith('Promoted') && !text.startsWith('Ad');
}

function extractAuthorHandle(tweetElement) {
  const links = tweetElement.querySelectorAll('[data-testid="User-Name"] a[href^="/"]');
  for (const link of links) {
    const handle = handleFromHref(link.getAttribute('href'));
    if (handle) return handle;
  }
  return 'unknown';
}

export function extractTweetId(tweetElement) {
  // Prefer the timestamp permalink, then any status link in the tweet.
  const timestampLink = tweetElement.querySelector('time')?.parentElement;
  if (timestampLink?.tagName === 'A') {
    const id = statusIdFromHref(timestampLink.getAttribute('href'));
    if (id) return id;
  }
  for (const link of tweetElement.querySelectorAll('a[href*="/status/"]')) {
    const id = statusIdFromHref(link.getAttribute('href'));
    if (id) return id;
  }
  return null;
}

/**
 * Cheap identity of a tweet (text, author, content hash) used for
 * de-duplication before doing the full extraction.
 * @param {Element} tweetElement
 * @returns {{text: string, author: string, contentHash: string} | null}
 *   null when the tweet has no text (e.g. media only).
 */
export function readTweetFingerprint(tweetElement) {
  const text = tweetElement.querySelector('[data-testid="tweetText"]')?.innerText || '';
  if (!text) return null;
  const author = extractAuthorHandle(tweetElement);
  return { text, author, contentHash: hashTweet(author, text) };
}

/**
 * Extracts everything the quiz generator needs from a tweet element.
 * @param {Element} tweetElement
 * @returns {{id: string, contentHash: string, text: string, author: string,
 *   displayName: string, mediaAlt: string[], timestamp: number} | null}
 */
export function extractTweetData(tweetElement) {
  const fingerprint = readTweetFingerprint(tweetElement);
  if (!fingerprint) return null;

  const mediaAlt = [...tweetElement.querySelectorAll('img[alt]:not([alt=""])')]
    .map((img) => img.alt)
    .filter(
      (alt) => alt.length > MIN_ALT_TEXT_LENGTH && !alt.includes('Avatar') && !alt.includes('Image')
    );

  return {
    id: extractTweetId(tweetElement) || fingerprint.contentHash,
    contentHash: fingerprint.contentHash,
    text: fingerprint.text,
    author: fingerprint.author,
    displayName:
      tweetElement.querySelector('[data-testid="User-Name"] span')?.innerText || fingerprint.author,
    mediaAlt,
    timestamp: Date.now(),
  };
}
