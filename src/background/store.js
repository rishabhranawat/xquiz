/**
 * Write-through persisted state for the service worker.
 *
 * MV3 service workers are terminated when idle, wiping module-level state.
 * Each store lazily loads its value from chrome.storage.local on first use
 * (concurrent first uses share one load) and writes every change back, so
 * handlers can simply `await store.get()` and never see stale/empty state.
 */

import { getLocal, setLocal } from '../shared/storage.js';

/**
 * @template T
 * @param {string} key chrome.storage.local key.
 * @param {() => T} createDefault Produces the value when nothing is stored.
 * @param {(raw: any) => T} [normalize] Validates/coerces the stored value.
 */
export function createStore(key, createDefault, normalize = (raw) => raw ?? createDefault()) {
  /** @type {T | undefined} */
  let cache;
  /** @type {Promise<T> | null} */
  let loading = null;

  /** @returns {Promise<T>} */
  async function get() {
    if (cache !== undefined) return cache;
    loading ??= getLocal(key).then((items) => {
      cache ??= normalize(items[key]);
      return cache;
    });
    return loading;
  }

  /** Replaces the value (cache first, so concurrent readers see it) and persists it. */
  async function set(value) {
    cache = value;
    await setLocal({ [key]: value });
    return value;
  }

  /**
   * Read-modify-write. `change` receives the current value and returns the
   * next one; the cache swap is synchronous so concurrent updates don't race.
   * @param {(current: T) => T} change
   */
  async function update(change) {
    const current = await get();
    return set(change(current));
  }

  return { get, set, update };
}
