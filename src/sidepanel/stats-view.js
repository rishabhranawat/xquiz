/**
 * Score / streak / accuracy bar at the top of the panel.
 */

import { accuracyPercent } from '../shared/stats.js';
import { byId } from './dom.js';

const STREAK_GLOW_THRESHOLD = 3;

export function createStatsView() {
  const score = byId('score');
  const streak = byId('streak');
  const accuracy = byId('accuracy');

  return {
    /** @param {import('../shared/stats.js').Stats} stats */
    render(stats) {
      score.textContent = `${stats.correctAnswers}/${stats.totalQuestions}`;
      streak.textContent = stats.currentStreak;
      const percent = accuracyPercent(stats);
      accuracy.textContent = percent === null ? '--%' : `${percent}%`;
      streak.classList.toggle('glow', stats.currentStreak >= STREAK_GLOW_THRESHOLD);
    },
  };
}
