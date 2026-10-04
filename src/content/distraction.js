/**
 * Distraction reduction features (currently: hiding tweets that contain video).
 */

const STYLE_ID = 'xquiz-hide-videos-style';
const ROOT_CLASS = 'xquiz-hide-videos';
const VIDEO_SELECTORS = ['video', '[data-testid="videoPlayer"]', '[aria-label="Video"]'];

/**
 * True if the tweet element contains a video player.
 * @param {Element | null} tweetElement
 */
export function tweetContainsVideo(tweetElement) {
  return Boolean(tweetElement?.querySelector(VIDEO_SELECTORS.join(', ')));
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `${VIDEO_SELECTORS.map(
    (selector) => `html.${ROOT_CLASS} article[data-testid="tweet"]:has(${selector})`
  ).join(',\n')} {\n  display: none !important;\n}`;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Shows or hides video tweets in the feed.
 * @param {boolean} hidden
 */
export function setVideosHidden(hidden) {
  if (hidden) {
    ensureStyle();
    document.documentElement.classList.add(ROOT_CLASS);
  } else {
    document.documentElement.classList.remove(ROOT_CLASS);
    document.getElementById(STYLE_ID)?.remove();
  }
}
