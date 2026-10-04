import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildIntentUrl,
  buildScorecardModel,
  buildShareText,
  formatRange,
  getRank,
} from '../src/shared/scorecard-model.js';
import { createEmptyStats } from '../src/shared/stats.js';

const NOW = new Date(2026, 9, 4, 12);
const stats = { totalQuestions: 20, correctAnswers: 18, currentStreak: 4, bestStreak: 9 };

test('getRank maps accuracy to tiers and needs a minimum sample', () => {
  assert.equal(getRank(95, 20).title, 'Laser Focus');
  assert.equal(getRank(90, 20).title, 'Laser Focus');
  assert.equal(getRank(80, 20).title, 'Sharp Reader');
  assert.equal(getRank(65, 20).title, 'Steady Scroller');
  assert.equal(getRank(45, 20).title, 'Casual Skimmer');
  assert.equal(getRank(10, 20).title, 'Doomscroller');
  assert.equal(getRank(100, 2).title, 'Just Getting Started');
  assert.equal(getRank(null, 0).title, 'Just Getting Started');
});

test('formatRange handles same-year and cross-year ranges', () => {
  assert.equal(formatRange(new Date(2026, 8, 28), NOW), 'Sep 28 – Oct 4, 2026');
  assert.equal(
    formatRange(new Date(2026, 11, 29), new Date(2027, 0, 4)),
    'Dec 29, 2026 – Jan 4, 2027'
  );
});

test('buildScorecardModel assembles stats and the last 7 days', () => {
  const model = buildScorecardModel({
    stats,
    now: NOW,
    dailyLog: {
      '2026-10-04': { answered: 3, correct: 3 },
      '2026-10-02': { answered: 5, correct: 4 },
    },
  });
  assert.equal(model.accuracy, 90);
  assert.deepEqual(model.score, { correct: 18, total: 20 });
  assert.equal(model.rank.title, 'Laser Focus');
  assert.deepEqual(model.today, { answered: 3, correct: 3 });
  assert.deepEqual(model.week, { answered: 8, correct: 7, accuracy: 88 });
  assert.equal(model.days.length, 7);
  assert.deepEqual(
    model.days.map((d) => d.label).join(''),
    'MTWTFSS' // Sep 28 2026 is a Monday
  );
  assert.equal(model.days[6].isToday, true);
  assert.equal(model.rangeLabel, 'Sep 28 – Oct 4, 2026');
});

test('buildScorecardModel works with brand new stats and no log', () => {
  const model = buildScorecardModel({ stats: createEmptyStats(), now: NOW });
  assert.equal(model.accuracy, null);
  assert.equal(model.week.accuracy, null);
  assert.equal(model.rank.title, 'Just Getting Started');
});

test('buildShareText contains only aggregate numbers and encodes into an intent URL', () => {
  const model = buildScorecardModel({ stats, now: NOW, dailyLog: {} });
  const text = buildShareText(model);
  assert.match(text, /90% retention accuracy/);
  assert.match(text, /Laser Focus/);
  assert.match(text, /Best streak: 9/);
  const url = buildIntentUrl(text);
  assert.ok(url.startsWith('https://twitter.com/intent/tweet?text='));
  assert.equal(new URL(url).searchParams.get('text'), text);
});
