/**
 * Pure "is this post being looked at" rule shared by the quiz tracker (touch
 * mode) and the digest dwell tracker. Operates on plain numbers so it is
 * testable without a DOM.
 */

import { DWELL_VISIBLE_RATIO } from './digest-constants.js';

/** IntersectionObserver thresholds fine-grained enough to notice 60% crossings. */
export const VISIBILITY_THRESHOLDS = Object.freeze(Array.from({ length: 21 }, (_, i) => i / 20));

/**
 * A post counts as visible when at least `minRatio` of it is on screen, or
 * (for posts taller than the viewport, which can never reach the ratio) when
 * the visible part fills `minRatio` of the viewport.
 *
 * @param {{isIntersecting: boolean, intersectionRatio: number,
 *   visibleHeight: number, viewportHeight: number}} sample
 * @param {number} [minRatio]
 */
export function isPostVisible(
  { isIntersecting, intersectionRatio, visibleHeight, viewportHeight },
  minRatio = DWELL_VISIBLE_RATIO
) {
  if (!isIntersecting) return false;
  return intersectionRatio >= minRatio || visibleHeight >= viewportHeight * minRatio;
}

/**
 * Adapts an IntersectionObserverEntry to isPostVisible.
 * @param {IntersectionObserverEntry} entry
 * @param {number} fallbackViewportHeight
 */
export function isEntryVisible(entry, fallbackViewportHeight) {
  return isPostVisible({
    isIntersecting: entry.isIntersecting,
    intersectionRatio: entry.intersectionRatio,
    visibleHeight: entry.intersectionRect.height,
    viewportHeight: entry.rootBounds?.height ?? fallbackViewportHeight,
  });
}
