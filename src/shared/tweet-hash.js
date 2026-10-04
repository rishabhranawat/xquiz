/**
 * Content-based tweet fingerprinting (pure). Used to de-duplicate tweets that
 * show up more than once (re-renders, retweets) and to remember which tweets
 * were already quizzed.
 */

/** Number of leading text characters that contribute to the hash. */
const HASH_TEXT_LENGTH = 100;

/**
 * Creates a short, stable, case-insensitive hash from the author handle and
 * the first characters of the tweet text (32-bit djb2 variant, decimal string).
 * @param {string} author
 * @param {string} text
 * @returns {string}
 */
export function hashTweet(author, text) {
  const content = `${author}:${text.slice(0, HASH_TEXT_LENGTH)}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0; // keep 32-bit
  }
  return hash.toString();
}
