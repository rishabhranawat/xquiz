/**
 * Tiny logger. `debug`/`info` are silent unless the bundle was built with
 * `npm run watch` (or XQUIZ_DEBUG=1); `warn`/`error` always print.
 * Never pass secrets (API keys) to the logger.
 */

// Replaced at build time by scripts/build.mjs; undefined when run unbundled.
const DEBUG = typeof __XQUIZ_DEBUG__ !== 'undefined' && __XQUIZ_DEBUG__;
const PREFIX = '[XQuiz]';

export const logger = {
  debug: (...args) => DEBUG && console.debug(PREFIX, ...args),
  info: (...args) => DEBUG && console.info(PREFIX, ...args),
  warn: (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
};
