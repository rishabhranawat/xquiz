/**
 * Local-day helpers (pure). A "day" is a YYYY-MM-DD string in the user's own
 * timezone, so a digest covers the calendar day as the user experienced it.
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * Local calendar day of a timestamp.
 * @param {number | Date} [when]
 * @returns {string} e.g. "2026-01-05"
 */
export function localDayKey(when = Date.now()) {
  const date = new Date(when);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** @param {unknown} value */
export function isDayKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * The day key `offset` days away from `dayKey` (negative = earlier).
 * @param {string} dayKey
 * @param {number} offset
 */
export function shiftDay(dayKey, offset) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return localDayKey(new Date(y, m - 1, d + offset));
}

/**
 * Day keys to retain: `today` and the `keep - 1` days before it.
 * @param {string} today
 * @param {number} keep
 * @returns {string[]} newest first
 */
export function retainedDays(today, keep) {
  return Array.from({ length: keep }, (_, i) => shiftDay(today, -i));
}

/**
 * Returns a copy of a `{ [dayKey]: value }` map without days outside the
 * retention window (or with malformed keys).
 * @template T
 * @param {Record<string, T>} byDay
 * @param {string} today
 * @param {number} keep
 * @returns {Record<string, T>}
 */
export function pruneByDay(byDay, today, keep) {
  const allowed = new Set(retainedDays(today, keep));
  return Object.fromEntries(Object.entries(byDay ?? {}).filter(([day]) => allowed.has(day)));
}

/**
 * Parses "HH:MM" (24h). Returns null when invalid.
 * @param {unknown} value
 * @returns {{hours: number, minutes: number} | null}
 */
export function parseTimeOfDay(value) {
  const match = typeof value === 'string' ? value.match(/^(\d{1,2}):(\d{2})$/) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? { hours, minutes } : null;
}

/**
 * Next local occurrence of a time of day strictly after `now`.
 * @param {number} now epoch ms
 * @param {string} timeOfDay "HH:MM"
 * @returns {number} epoch ms
 */
export function nextOccurrence(now, timeOfDay) {
  const { hours, minutes } = parseTimeOfDay(timeOfDay) ?? { hours: 21, minutes: 0 };
  const date = new Date(now);
  const candidate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
  if (candidate.getTime() <= now) candidate.setDate(candidate.getDate() + 1);
  return candidate.getTime();
}

/**
 * True once today's delivery time has passed.
 * @param {number} now
 * @param {string} timeOfDay
 */
export function isPastDeliveryTime(now, timeOfDay) {
  const { hours, minutes } = parseTimeOfDay(timeOfDay) ?? { hours: 21, minutes: 0 };
  const date = new Date(now);
  return now >= new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}
