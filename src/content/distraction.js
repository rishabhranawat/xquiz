/**
 * Distraction mode: hides video posts and/or image-only posts from the feed.
 *
 * X renders the feed as a virtualized list that recycles DOM nodes, so a CSS
 * `:has()` rule alone is not enough (image-only needs text inspection and
 * posts hydrate late). Instead `scan()` classifies every rendered post and
 * stamps hidden ones with `data-xquiz-hidden`; one injected rule turns that
 * attribute into `display: none`. Each scan re-evaluates every post, so
 * recycled or late-hydrating nodes self-correct, and turning the feature off
 * strips every attribute immediately. The surrounding list cell is collapsed
 * too (when it holds only that post) so no empty gap is left behind.
 */

import { extractTweetId, findTweetElements } from './tweet-extractor.js';
import { classifyPostElement, shouldHidePost } from './post-classifier.js';

export const HIDDEN_ATTR = 'data-xquiz-hidden';
const HIDDEN_CELL_ATTR = 'data-xquiz-hidden-cell';
const CELL_SELECTOR = '[data-testid="cellInnerDiv"]';
const STYLE_ID = 'xquiz-distraction-style';
const STYLE = `article[${HIDDEN_ATTR}], [${HIDDEN_CELL_ATTR}] {\n  display: none !important;\n}`;

/** True if Distraction mode currently hides this post. */
export const isPostHidden = (tweetElement) => tweetElement.hasAttribute(HIDDEN_ATTR);

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE;
  (document.head || document.documentElement).appendChild(style);
}

function setCellHidden(article, hidden) {
  const cell = article.closest(CELL_SELECTOR);
  if (!cell) return;
  // Only collapse cells that hold just this post (not conversation threads).
  const collapsible = hidden && cell.querySelectorAll('article[data-testid="tweet"]').length === 1;
  cell.toggleAttribute(HIDDEN_CELL_ATTR, collapsible);
}

/**
 * @param {object} [hooks]
 * @param {(hiddenCount: number) => void} [hooks.onCountChange] Called when the
 *   number of distinct posts hidden since Distraction mode was enabled changes.
 */
export function createDistractionFilter({ onCountChange } = {}) {
  let options = { distractionMode: false, hideVideos: true, hideImageOnly: true };
  const countedIds = new Set();
  const countedElements = new WeakSet();
  let hiddenCount = 0;

  function countHidden(article) {
    const id = extractTweetId(article);
    if (id ? countedIds.has(id) : countedElements.has(article)) return;
    if (id) countedIds.add(id);
    else countedElements.add(article);
    hiddenCount += 1;
    onCountChange?.(hiddenCount);
  }

  function evaluate(article) {
    const kind = classifyPostElement(article);
    const hide = kind !== null && shouldHidePost(kind, options);
    if (hide) {
      article.setAttribute(HIDDEN_ATTR, kind);
      countHidden(article);
    } else {
      article.removeAttribute(HIDDEN_ATTR);
    }
    setCellHidden(article, hide);
  }

  function restoreAll() {
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) => el.removeAttribute(HIDDEN_ATTR));
    document
      .querySelectorAll(`[${HIDDEN_CELL_ATTR}]`)
      .forEach((el) => el.removeAttribute(HIDDEN_CELL_ATTR));
    countedIds.clear();
    hiddenCount = 0;
    onCountChange?.(0);
  }

  /** Classifies every rendered post and hides or reveals it. Cheap and idempotent. */
  function scan() {
    if (!options.distractionMode) return;
    findTweetElements().forEach(evaluate);
  }

  return {
    scan,

    /**
     * Applies new settings; takes effect immediately.
     * @param {{distractionMode: boolean, hideVideos: boolean, hideImageOnly: boolean}} next
     */
    apply({ distractionMode, hideVideos, hideImageOnly }) {
      options = { distractionMode, hideVideos, hideImageOnly };
      if (distractionMode) {
        ensureStyle();
        scan();
      } else {
        restoreAll();
        document.getElementById(STYLE_ID)?.remove();
      }
    },

    /** Number of distinct posts hidden since Distraction mode was turned on. */
    get hiddenCount() {
      return hiddenCount;
    },
  };
}
