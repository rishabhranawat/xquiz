/**
 * Pure per-day answer log helpers (no chrome APIs). Persistence lives in
 * background/stats.js.
 *
 * The log maps a local calendar date (`YYYY-MM-DD`) to how many questions were
 * answered / answered correctly that day. Only the most recent
 * DAILY_LOG_DAYS days are kept.
 */

export const DAILY_LOG_DAYS = 30;

/** @typedef {{answered: number, correct: number}} DayTotals */
/** @typedef {Record<string, DayTotals>} DailyLog */

const pad = (value) => String(value).padStart(2, '0');
const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Local calendar date key for a Date.
 * @param {Date} date
 * @returns {string} e.g. `2026-10-04`
 */
export function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parses a date key into a local Date at midnight, or null if invalid.
 * @param {string} key
 * @returns {Date | null}
 */
export function parseDateKey(key) {
  const match = KEY_PATTERN.exec(key);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return dateKey(date) === key ? date : null;
}

/**
 * The calendar day `offset` days away from `date` (DST safe).
 * @param {Date} date
 * @param {number} offset
 */
export function addDays(date, offset) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
}

/** @returns {DailyLog} */
export function createEmptyLog() {
  return {};
}

/**
 * Drops entries older than `days` calendar days (including today).
 * @param {DailyLog} log
 * @param {Date} now
 * @param {number} [days]
 * @returns {DailyLog}
 */
export function pruneLog(log, now, days = DAILY_LOG_DAYS) {
  const oldest = dateKey(addDays(now, -(days - 1)));
  return Object.fromEntries(Object.entries(log).filter(([key]) => key >= oldest));
}

const isCount = (value) => Number.isInteger(value) && value >= 0;

/**
 * Coerces a stored value into a valid log: malformed entries are dropped.
 * Missing/garbage input yields an empty log, so older installs just work.
 * @param {unknown} raw
 * @param {Date} [now]
 * @returns {DailyLog}
 */
export function normalizeLog(raw, now = new Date()) {
  const log = createEmptyLog();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return log;
  for (const [key, value] of Object.entries(raw)) {
    if (!parseDateKey(key) || !value) continue;
    const { answered, correct } = /** @type {any} */ (value);
    if (isCount(answered) && isCount(correct) && correct <= answered) {
      log[key] = { answered, correct };
    }
  }
  return pruneLog(log, now);
}

/**
 * Returns a new log with one more answer on `now`'s day. Does not mutate.
 * @param {DailyLog} log
 * @param {boolean} isCorrect
 * @param {Date} [now]
 * @returns {DailyLog}
 */
export function recordDailyAnswer(log, isCorrect, now = new Date()) {
  const key = dateKey(now);
  const day = log[key] ?? { answered: 0, correct: 0 };
  const next = {
    ...log,
    [key]: { answered: day.answered + 1, correct: day.correct + (isCorrect ? 1 : 0) },
  };
  return pruneLog(next, now);
}

/**
 * The last `count` days ending today, oldest first, zero-filled.
 * @param {DailyLog} log
 * @param {Date} now
 * @param {number} [count]
 * @returns {{date: string, answered: number, correct: number}[]}
 */
export function recentDays(log, now, count = 7) {
  return Array.from({ length: count }, (_, index) => {
    const date = dateKey(addDays(now, index - (count - 1)));
    const { answered = 0, correct = 0 } = log[date] ?? {};
    return { date, answered, correct };
  });
}

/**
 * Totals across a list of days.
 * @param {{answered: number, correct: number}[]} days
 * @returns {{answered: number, correct: number, accuracy: number | null}}
 */
export function summarizeDays(days) {
  const answered = days.reduce((sum, day) => sum + day.answered, 0);
  const correct = days.reduce((sum, day) => sum + day.correct, 0);
  return { answered, correct, accuracy: answered ? Math.round((correct / answered) * 100) : null };
}
