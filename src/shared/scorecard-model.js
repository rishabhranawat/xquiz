/**
 * Pure view-model for the shareable scorecard: turns stats plus the daily log
 * into exactly what the card shows. Contains no tweet content or personal data.
 */

import { addDays, parseDateKey, recentDays, summarizeDays } from './daily-log.js';
import { accuracyPercent } from './stats.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Answers needed before an accuracy rank is meaningful. */
export const MIN_ANSWERS_FOR_RANK = 5;

/** Rank tiers, best first. A tier applies when accuracy >= `min`. */
const RANKS = [
  { min: 90, title: 'Laser Focus', tagline: 'Nothing slips past this feed reader.' },
  { min: 75, title: 'Sharp Reader', tagline: 'Actually reading, not just scrolling.' },
  { min: 60, title: 'Steady Scroller', tagline: 'Most of it sticks. Not bad.' },
  { min: 40, title: 'Casual Skimmer', tagline: 'Plenty of scrolling, some remembering.' },
  { min: 0, title: 'Doomscroller', tagline: 'Eyes on the feed, mind elsewhere.' },
];

const UNRANKED = { title: 'Just Getting Started', tagline: 'Keep answering to earn a rank.' };

/**
 * Rank title and tagline for an accuracy.
 * @param {number | null} accuracy Rounded percent, or null when unknown.
 * @param {number} totalAnswered
 */
export function getRank(accuracy, totalAnswered) {
  if (accuracy === null || totalAnswered < MIN_ANSWERS_FOR_RANK) return UNRANKED;
  return RANKS.find((rank) => accuracy >= rank.min) ?? UNRANKED;
}

/**
 * "Sep 28 - Oct 4, 2026" style label (en dash).
 * @param {Date} start
 * @param {Date} end
 */
export function formatRange(start, end) {
  const from = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const to = `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  const year = end.getFullYear();
  if (start.getFullYear() !== year) return `${from}, ${start.getFullYear()} – ${to}, ${year}`;
  return `${from} – ${to}, ${year}`;
}

/**
 * @typedef {object} ScorecardModel
 * @property {number | null} accuracy
 * @property {{correct: number, total: number}} score
 * @property {number} streak
 * @property {number} bestStreak
 * @property {{title: string, tagline: string}} rank
 * @property {{answered: number, correct: number}} today
 * @property {{answered: number, correct: number, accuracy: number | null}} week
 * @property {{date: string, label: string, answered: number, correct: number, isToday: boolean}[]} days
 * @property {string} rangeLabel
 */

/**
 * @param {{stats: import('./stats.js').Stats, dailyLog?: import('./daily-log.js').DailyLog, now?: Date}} input
 * @returns {ScorecardModel}
 */
export function buildScorecardModel({ stats, dailyLog = {}, now = new Date() }) {
  const days = recentDays(dailyLog, now, 7).map((day, index, all) => ({
    ...day,
    label: WEEKDAYS[parseDateKey(day.date)?.getDay() ?? 0],
    isToday: index === all.length - 1,
  }));
  const accuracy = accuracyPercent(stats);
  return {
    accuracy,
    score: { correct: stats.correctAnswers, total: stats.totalQuestions },
    streak: stats.currentStreak,
    bestStreak: stats.bestStreak,
    rank: getRank(accuracy, stats.totalQuestions),
    today: { answered: days[6].answered, correct: days[6].correct },
    week: summarizeDays(days),
    days,
    rangeLabel: formatRange(addDays(now, -6), now),
  };
}

/**
 * Text pre-filled when posting to X. Only aggregate numbers, never content.
 * @param {ScorecardModel} model
 */
export function buildShareText(model) {
  const lines = ['Testing my attention span on X with XQuiz.', ''];
  if (model.accuracy !== null) lines.push(`${model.accuracy}% retention accuracy`);
  lines.push(`${model.rank.title}: ${model.rank.tagline}`);
  if (model.week.answered > 0) {
    lines.push(`${model.week.answered} questions answered in the last 7 days`);
  }
  if (model.bestStreak > 0) lines.push(`Best streak: ${model.bestStreak}`);
  lines.push('', 'Are you actually reading your feed or just scrolling?');
  return lines.join('\n');
}

/** @param {string} text */
export const buildIntentUrl = (text) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
