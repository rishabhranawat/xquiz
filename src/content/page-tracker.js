/**
 * Decides which X pages count toward quizzes, and detects SPA navigation.
 * The matching functions are pure (pathname in, boolean out).
 */

import { PAGE_IDS, RESERVED_USER_SLUGS } from '../shared/constants.js';

const RESERVED_SLUGS = new Set(RESERVED_USER_SLUGS);
const HANDLE_PATTERN = /^[a-z0-9_]{1,15}$/i;

/**
 * True when `pathname` belongs to a user profile (e.g. `/jack`,
 * `/jack/status/123`) rather than an application route like `/settings`.
 * @param {string} pathname
 */
export function isProfilePath(pathname) {
  const [handle] = pathname.split('/').filter(Boolean);
  if (!handle) return false;
  return !RESERVED_SLUGS.has(handle.toLowerCase()) && HANDLE_PATTERN.test(handle);
}

/**
 * True when tweets on `pathname` should be tracked given the user's choices.
 * @param {string} pathname e.g. `window.location.pathname`
 * @param {Iterable<string>} allowedPages Values of PAGE_IDS.
 */
export function isOnTrackedPage(pathname, allowedPages) {
  const allowed = new Set(allowedPages);
  const path = pathname || '/';
  if (allowed.has(PAGE_IDS.HOME) && (path === '/' || path === '/home')) return true;
  if (allowed.has(PAGE_IDS.PROFILES) && isProfilePath(path)) return true;
  return false;
}

/**
 * Calls `onChange` whenever the URL changes without a page load (X is a SPA)
 * or on back/forward navigation.
 * @param {() => void} onChange
 */
export function watchNavigation(onChange) {
  let lastUrl = window.location.href;
  new MutationObserver(() => {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;
    onChange();
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => setTimeout(onChange, 100));
}
