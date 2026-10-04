/**
 * Remembers which tweets were already used for a quiz so the same content is
 * never quizzed twice. Keyed by tweet content hash (falling back to tweet id).
 */

import { LIMITS, MESSAGE_TYPES, STORAGE_KEYS } from '../shared/constants.js';
import { createStore } from './store.js';

const usedStore = createStore(
  STORAGE_KEYS.USED_TWEET_HASHES,
  () => [],
  (raw) => (Array.isArray(raw) ? raw : [])
);

/** Identity used to detect repeats. */
export const tweetKey = (tweet) => tweet.contentHash || tweet.id;

/**
 * Tweets whose key is not in `usedKeys`.
 * @param {object[]} tweets
 * @param {Iterable<string>} usedKeys
 */
export function filterUnusedTweets(tweets, usedKeys) {
  const used = new Set(usedKeys);
  return tweets.filter((tweet) => !used.has(tweetKey(tweet)));
}

/**
 * Returns `usedKeys` plus the given tweets' keys, keeping only the newest `max`.
 * @param {string[]} usedKeys
 * @param {object[]} tweets
 * @param {number} [max]
 */
export function addUsedTweetKeys(usedKeys, tweets, max = LIMITS.MAX_USED_TWEET_HASHES) {
  const merged = new Set(usedKeys);
  for (const tweet of tweets) {
    const key = tweetKey(tweet);
    merged.delete(key); // re-insert so it counts as newest
    merged.add(key);
  }
  return [...merged].slice(-max);
}

/**
 * Atomically selects the tweets not yet used and marks them as used.
 * @param {object[]} tweets
 * @returns {Promise<object[]>} the previously unused tweets (possibly empty)
 */
export async function claimUnusedTweets(tweets) {
  let unused = [];
  await usedStore.update((usedKeys) => {
    unused = filterUnusedTweets(tweets, usedKeys);
    return unused.length ? addUsedTweetKeys(usedKeys, unused) : usedKeys;
  });
  return unused;
}

export const messageHandlers = {
  [MESSAGE_TYPES.CLEAR_TWEET_HISTORY]: async () => {
    await usedStore.set([]);
    return { success: true };
  },
};
