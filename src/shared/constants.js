/**
 * Single source of truth for values shared between the service worker,
 * content script and side panel. This module must stay free of side effects
 * and browser/chrome APIs so it can be imported anywhere (including tests).
 */

export const GEMINI_MODEL = 'gemini-2.0-flash';
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Pages the user can opt in to tracking (see `allowedPages` setting). */
export const PAGE_IDS = {
  HOME: 'home',
  PROFILES: 'profiles',
};

/** Default values for every user setting. Add new settings here first. */
export const DEFAULT_SETTINGS = Object.freeze({
  tweetsPerQuiz: 5,
  apiKey: '',
  distractionMode: false,
  hideVideos: true,
  hideImageOnly: true,
  viewTimeMs: 2000,
  allowedPages: Object.freeze([PAGE_IDS.HOME]),
});

/** Allowed ranges for numeric settings (mirrors the settings sliders). */
export const SETTING_LIMITS = Object.freeze({
  tweetsPerQuiz: { min: 3, max: 10 },
  viewTimeMs: { min: 1000, max: 6000 },
});

/**
 * Settings synced across devices via chrome.storage.sync. Everything else in
 * DEFAULT_SETTINGS (the API key) lives in chrome.storage.local only.
 */
export const SYNC_SETTING_KEYS = Object.freeze([
  'tweetsPerQuiz',
  'distractionMode',
  'hideVideos',
  'hideImageOnly',
  'viewTimeMs',
  'allowedPages',
]);

/**
 * Settings keys that older versions stored in chrome.storage.sync. They are
 * read once so they can be migrated (see migrateLegacySettings) and removed.
 */
export const LEGACY_SYNC_SETTING_KEYS = Object.freeze(['removeVideos']);

export const QUIZ_TYPES = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  FILL_BLANK: 'fill_blank',
});

/** Human readable quiz type names, keyed by QUIZ_TYPES value. */
export const QUIZ_TYPE_LABELS = Object.freeze({
  [QUIZ_TYPES.MULTIPLE_CHOICE]: 'Multiple Choice',
  [QUIZ_TYPES.TRUE_FALSE]: 'True or False',
  [QUIZ_TYPES.FILL_BLANK]: 'Fill in the Blank',
});

export const DEFAULT_STATS = Object.freeze({
  totalQuestions: 0,
  correctAnswers: 0,
  currentStreak: 0,
  bestStreak: 0,
});

/**
 * Every runtime message exchanged between extension contexts.
 * Wire format: `{ type: MESSAGE_TYPES.X, ...payload }`.
 */
export const MESSAGE_TYPES = Object.freeze({
  // Content script -> background
  TWEETS_COLLECTED: 'TWEETS_COLLECTED',
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',

  // Side panel -> background
  REQUEST_QUIZ: 'REQUEST_QUIZ',
  SUBMIT_ANSWER: 'SUBMIT_ANSWER',
  GET_STATS: 'GET_STATS',
  RESET_STATS: 'RESET_STATS',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_QUIZ_HISTORY: 'GET_QUIZ_HISTORY',
  CLEAR_QUIZ_HISTORY: 'CLEAR_QUIZ_HISTORY',
  CLEAR_TWEET_HISTORY: 'CLEAR_TWEET_HISTORY',

  // Content script -> side panel (delivered directly; the background ignores it)
  TWEET_PROGRESS: 'TWEET_PROGRESS',

  // Background -> side panel
  QUIZ_READY: 'QUIZ_READY',
  QUIZ_ERROR: 'QUIZ_ERROR',

  // Background -> content script
  ENABLE_AUTO_OPEN: 'XQUIZ_ENABLE_AUTO_OPEN',
});

/** chrome.storage keys. */
export const STORAGE_KEYS = Object.freeze({
  STATS: 'stats',
  USED_TWEET_HASHES: 'usedTweetHashes',
  QUIZ_HISTORY: 'quizHistory',
  QUIZ_QUEUE: 'quizQueue',
  DAILY_LOG: 'dailyLog',
});

/** Caps that keep persisted state bounded. */
export const LIMITS = Object.freeze({
  MAX_USED_TWEET_HASHES: 1000,
  MAX_QUIZ_HISTORY: 50,
  MAX_QUEUED_QUIZZES: 20,
});

/** Hostnames the extension runs on (keep in sync with manifest.json). */
export const X_HOSTNAMES = Object.freeze(['x.com', 'twitter.com']);

/** First path segments on X that are application routes, not user handles. */
export const RESERVED_USER_SLUGS = Object.freeze([
  'home',
  'explore',
  'notifications',
  'messages',
  'settings',
  'search',
  'i',
  'tos',
  'privacy',
  'compose',
  'signup',
  'login',
  'about',
  'support',
]);

export const SIDE_PANEL_PATH = 'sidepanel/index.html';
