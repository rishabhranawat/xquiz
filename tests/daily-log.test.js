import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  dateKey,
  normalizeLog,
  parseDateKey,
  pruneLog,
  recentDays,
  recordDailyAnswer,
  summarizeDays,
} from '../src/shared/daily-log.js';

const NOW = new Date(2026, 9, 4, 15, 30); // Oct 4 2026, local time

test('dateKey and parseDateKey round trip and reject bad input', () => {
  assert.equal(dateKey(NOW), '2026-10-04');
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(dateKey(parseDateKey('2026-02-28')), '2026-02-28');
  assert.equal(parseDateKey('2026-02-30'), null);
  assert.equal(parseDateKey('nope'), null);
});

test('recordDailyAnswer counts per day without mutating', () => {
  const empty = {};
  const one = recordDailyAnswer(empty, true, NOW);
  const two = recordDailyAnswer(one, false, NOW);
  assert.deepEqual(empty, {});
  assert.deepEqual(one, { '2026-10-04': { answered: 1, correct: 1 } });
  assert.deepEqual(two, { '2026-10-04': { answered: 2, correct: 1 } });
});

test('pruneLog keeps only the last 30 days including today', () => {
  const log = {
    [dateKey(addDays(NOW, -29))]: { answered: 1, correct: 1 },
    [dateKey(addDays(NOW, -30))]: { answered: 9, correct: 9 },
    '2026-10-04': { answered: 2, correct: 1 },
  };
  assert.deepEqual(Object.keys(pruneLog(log, NOW)).sort(), [
    dateKey(addDays(NOW, -29)),
    '2026-10-04',
  ]);
});

test('recordDailyAnswer prunes old days as new ones are added', () => {
  const old = { '2026-08-01': { answered: 3, correct: 3 } };
  assert.deepEqual(Object.keys(recordDailyAnswer(old, true, NOW)), ['2026-10-04']);
});

test('normalizeLog tolerates missing and malformed data', () => {
  assert.deepEqual(normalizeLog(undefined, NOW), {});
  assert.deepEqual(normalizeLog([1, 2], NOW), {});
  assert.deepEqual(
    normalizeLog(
      {
        '2026-10-03': { answered: 4, correct: 3 },
        '2026-10-02': { answered: 1, correct: 2 },
        '2026-10-01': { answered: -1, correct: 0 },
        bad: { answered: 1, correct: 1 },
        '2026-09-30': null,
      },
      NOW
    ),
    { '2026-10-03': { answered: 4, correct: 3 } }
  );
});

test('recentDays zero-fills seven days ending today, oldest first', () => {
  const days = recentDays({ '2026-10-04': { answered: 2, correct: 1 } }, NOW);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-09-28');
  assert.deepEqual(days[6], { date: '2026-10-04', answered: 2, correct: 1 });
  assert.deepEqual(days[3], { date: '2026-10-01', answered: 0, correct: 0 });
});

test('recentDays crosses month and year boundaries', () => {
  const days = recentDays({}, new Date(2027, 0, 2));
  assert.equal(days[0].date, '2026-12-27');
});

test('summarizeDays totals and rounds accuracy, null when empty', () => {
  assert.deepEqual(summarizeDays([]), { answered: 0, correct: 0, accuracy: null });
  assert.deepEqual(
    summarizeDays([
      { answered: 3, correct: 2 },
      { answered: 0, correct: 0 },
    ]),
    { answered: 3, correct: 2, accuracy: 67 }
  );
});
