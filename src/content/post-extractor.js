/**
 * Reads what the digest needs from a post element. Unlike quiz collection it
 * accepts every post that has text, however short.
 */

import { DIGEST_LIMITS } from '../shared/digest-constants.js';
import { extractTweetData } from './tweet-extractor.js';

const MEDIA_SELECTOR = '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], video';
const PROMOTED_LABELS = new Set(['Ad', 'Promoted']);

/**
 * True for ads: X marks them with a placement-tracking wrapper and an "Ad" /
 * "Promoted" label (a childless span, so post text starting with "Ad" is safe).
 * @param {Element} postElement
 */
export function isPromotedPost(postElement) {
  if (postElement.querySelector('[data-testid="placementTracking"]')) return true;
  for (const span of postElement.querySelectorAll('span')) {
    if (span.children.length === 0 && PROMOTED_LABELS.has(span.textContent.trim())) return true;
  }
  return false;
}

/**
 * @param {Element} postElement
 * @returns {{id: string, author: string, displayName: string, text: string,
 *   hasMedia: boolean} | null} null for ads and posts without text
 */
export function extractReadablePost(postElement) {
  if (isPromotedPost(postElement)) return null;
  const tweet = extractTweetData(postElement);
  if (!tweet) return null;
  return {
    id: tweet.id,
    author: tweet.author,
    displayName: tweet.displayName,
    text: tweet.text.slice(0, DIGEST_LIMITS.MAX_TEXT_LENGTH),
    hasMedia: Boolean(postElement.querySelector(MEDIA_SELECTOR)),
  };
}
