/**
 * Buffers tweets the user has read and remembers what was already collected
 * so each tweet is counted once per page session. Pure state, no DOM/chrome.
 */

export function createTweetCollector() {
  const seenIds = new Set();
  const seenHashes = new Set();
  let buffer = [];

  return {
    /** True if a tweet with this content hash was already collected. */
    hasSeen: (contentHash) => seenHashes.has(contentHash),

    /**
     * Adds a tweet unless it was seen before (by id or content hash).
     * @param {{id: string, contentHash: string}} tweet
     * @returns {boolean} whether the tweet was added
     */
    add(tweet) {
      if (seenIds.has(tweet.id) || seenHashes.has(tweet.contentHash)) return false;
      seenIds.add(tweet.id);
      seenHashes.add(tweet.contentHash);
      buffer.push(tweet);
      return true;
    },

    /** Number of buffered tweets. */
    get size() {
      return buffer.length;
    },

    /** Returns the buffered tweets and empties the buffer. */
    drain() {
      const tweets = buffer;
      buffer = [];
      return tweets;
    },
  };
}
