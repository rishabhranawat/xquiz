/**
 * Pure settings helpers (no chrome APIs). Persistence lives in storage.js.
 */

import { DEFAULT_SETTINGS, PAGE_IDS, SETTING_LIMITS } from './constants.js';

const KNOWN_PAGE_IDS = new Set(Object.values(PAGE_IDS));

function clampInt(value, { min, max }, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number === 0) return fallback;
  return Math.min(Math.max(number, min), max);
}

function normalizePages(pages) {
  const valid = Array.isArray(pages)
    ? [...new Set(pages)].filter((p) => KNOWN_PAGE_IDS.has(p))
    : [];
  return valid.length ? valid : [...DEFAULT_SETTINGS.allowedPages];
}

/**
 * Coerces untrusted/partial settings (storage contents, UI input) into a
 * complete, valid settings object. Missing or invalid fields fall back to
 * DEFAULT_SETTINGS; numeric fields are clamped to SETTING_LIMITS.
 * @param {Partial<typeof DEFAULT_SETTINGS> | null | undefined} raw
 * @returns {{tweetsPerQuiz: number, apiKey: string, removeVideos: boolean,
 *   viewTimeMs: number, allowedPages: string[]}}
 */
export function normalizeSettings(raw) {
  const source = raw ?? {};
  return {
    tweetsPerQuiz: clampInt(
      source.tweetsPerQuiz,
      SETTING_LIMITS.tweetsPerQuiz,
      DEFAULT_SETTINGS.tweetsPerQuiz
    ),
    apiKey: typeof source.apiKey === 'string' ? source.apiKey.trim() : DEFAULT_SETTINGS.apiKey,
    removeVideos: Boolean(source.removeVideos),
    viewTimeMs: clampInt(source.viewTimeMs, SETTING_LIMITS.viewTimeMs, DEFAULT_SETTINGS.viewTimeMs),
    allowedPages: normalizePages(source.allowedPages),
  };
}
