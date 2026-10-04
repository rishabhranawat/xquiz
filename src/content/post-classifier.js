/**
 * Classifies feed posts for Distraction mode.
 *
 * The decision logic (`stripMediaLinks`, `classifyPost`, `shouldHidePost`) is
 * pure and unit tested. `describePost` is the only part that touches X's DOM;
 * its selectors live here because they are what breaks when X changes markup.
 *
 * Definitions
 * - video:      the post plays a video (animated GIFs are treated as images).
 * - image-only: the post has a picture, GIF or link card but no text of its
 *               own. Text that is empty, whitespace, or only t.co / pic.x.com
 *               media links counts as no text. Hashtags, emoji and ordinary
 *               words are real text, so such posts are never hidden.
 * - text:       everything else.
 *
 * Quote tweets and retweets
 * - A reposted post is the original post in the feed, so it is classified
 *   like any other post.
 * - A quote tweet is judged as one unit: its text is the commentary plus the
 *   quoted post's text, and media anywhere inside it counts. A quote with
 *   commentary, or quoting a post that has text, stays visible; only a
 *   commentary-free quote of a text-less image post is hidden.
 * - A video inside a quoted post makes the whole post a video post.
 * Ads are deliberately not special-cased.
 */

/** @typedef {'video' | 'image-only' | 'text'} PostKind */
/** @typedef {{hasVideo: boolean, hasImage: boolean, text: string}} PostDescriptor */

const MEDIA_LINK_PATTERN = /(?:https?:\/\/)?(?:t\.co|pic\.(?:twitter|x)\.com)\/\S*/gi;
// Zero-width characters X sometimes pads text with.
// eslint-disable-next-line no-irregular-whitespace
const INVISIBLE_PATTERN = /[​-‍⁠﻿]/g;

const TEXT_SELECTOR = '[data-testid="tweetText"]';
const HEADER_SELECTOR = '[data-testid="User-Name"]';
const PLAYER_SELECTOR = 'video, [data-testid="videoPlayer"], [data-testid="videoComponent"]';
const GIF_CONTAINER_SELECTOR = '[data-testid="gifPlayer"]';
const IMAGE_SELECTOR = [
  '[data-testid="tweetPhoto"]',
  'img[src*="pbs.twimg.com/media/"]',
  '[data-testid="card.wrapper"]',
].join(', ');

/**
 * Removes media links, invisible characters and whitespace; what is left is
 * the text the author actually wrote.
 * @param {string | null | undefined} text
 */
export function stripMediaLinks(text) {
  return (text ?? '').replace(MEDIA_LINK_PATTERN, '').replace(INVISIBLE_PATTERN, '').trim();
}

/**
 * @param {PostDescriptor} post
 * @returns {PostKind}
 */
export function classifyPost({ hasVideo, hasImage, text }) {
  if (hasVideo) return 'video';
  if (hasImage && stripMediaLinks(text) === '') return 'image-only';
  return 'text';
}

/**
 * @param {PostKind} kind
 * @param {{distractionMode: boolean, hideVideos: boolean, hideImageOnly: boolean}} options
 */
export function shouldHidePost(kind, { distractionMode, hideVideos, hideImageOnly }) {
  if (!distractionMode) return false;
  return (kind === 'video' && hideVideos) || (kind === 'image-only' && hideImageOnly);
}

/** X serves animated GIFs as looping videos from /tweet_video/. */
function isGifPlayer(player) {
  if (player.closest(GIF_CONTAINER_SELECTOR)) return true;
  const videos = player.tagName === 'VIDEO' ? [player] : [...player.querySelectorAll('video')];
  return (
    videos.length > 0 &&
    videos.every((video) =>
      `${video.getAttribute('src') ?? ''} ${video.getAttribute('poster') ?? ''}`.includes(
        'tweet_video'
      )
    )
  );
}

/**
 * Reads a post element into a descriptor. Returns null while the post has
 * not finished rendering (no author header yet), so callers leave it alone
 * instead of judging a half-built skeleton.
 * @param {Element} article
 * @returns {PostDescriptor | null}
 */
export function describePost(article) {
  if (!article.querySelector(HEADER_SELECTOR)) return null;

  const players = [...article.querySelectorAll(PLAYER_SELECTOR)];
  return {
    hasVideo: players.some((player) => !isGifPlayer(player)),
    hasImage:
      players.some((player) => isGifPlayer(player)) ||
      article.querySelector(IMAGE_SELECTOR) !== null,
    text: [...article.querySelectorAll(TEXT_SELECTOR)].map((el) => el.textContent).join(' '),
  };
}

/**
 * @param {Element} article
 * @returns {PostKind | null} null when the post is not fully rendered yet.
 */
export function classifyPostElement(article) {
  const descriptor = describePost(article);
  return descriptor && classifyPost(descriptor);
}
