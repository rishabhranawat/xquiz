/**
 * Platform shim: one place that decides which WebExtension namespace to use
 * and which optional APIs exist in the current browser.
 *
 * - Chrome exposes `chrome.*`; Safari (and Firefox) expose `browser.*` and in
 *   Safari `chrome.*` is an alias. Preferring `browser` when present is safe
 *   everywhere because it is promise based.
 * - Resolution is lazy (on every property access) so importing this module
 *   never touches the extension APIs and unit tests can install fakes later.
 * - Optional APIs are feature-detected, never sniffed by user agent:
 *   `sidePanel` (Chrome only), `notifications` (not in Safari), `alarms`
 *   (Safari: supported but non-persistent workers may miss them, so callers
 *   must keep a foreground catch-up path).
 */

/** The active extension API namespace, or undefined outside an extension. */
export function getApi() {
  return globalThis.browser ?? globalThis.chrome;
}

/**
 * Lazy proxy for the extension namespace: `ext.storage.local.get(...)`.
 * @type {typeof chrome}
 */
export const ext = new Proxy(/** @type {any} */ ({}), {
  get(_target, property) {
    return getApi()?.[property];
  },
});

const has = (name, method) => typeof getApi()?.[name]?.[method] === 'function';

/** Chrome's side panel; absent in Safari. */
export const hasSidePanel = () => has('sidePanel', 'open') && has('sidePanel', 'setOptions');

/** Desktop notifications; absent in Safari web extensions. */
export const hasNotifications = () => has('notifications', 'create');

/** chrome.alarms; present in Safari but not guaranteed to wake the worker. */
export const hasAlarms = () => has('alarms', 'create') && has('alarms', 'get');

/**
 * True when the primary input cannot hover (phones, tablets).
 * @param {typeof globalThis} [scope]
 */
export function isTouchPrimary(scope = globalThis) {
  try {
    if (scope.matchMedia?.('(hover: none)').matches) return true;
    return Boolean(scope.matchMedia?.('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}
