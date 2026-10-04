import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  accuracyPercent,
  createEmptyStats,
  normalizeStats,
  recordAnswer,
} from '../src/shared/stats.js';

test('createEmptyStats returns zeroed, independent objects', () => {
  const a = createEmptyStats();
  assert.deepEqual(a, { totalQuestions: 0, correctAnswers: 0, currentStreak: 0, bestStreak: 0 });
  a.totalQuestions = 5;
  assert.equal(createEmptyStats().totalQuestions, 0);
});

test('recordAnswer tracks correct answers and streaks without mutating', () => {
  const start = createEmptyStats();
  const one = recordAnswer(start, true);
  const two = recordAnswer(one, true);
  assert.deepEqual(start, createEmptyStats());
  assert.deepEqual(two, { totalQuestions: 2, correctAnswers: 2, currentStreak: 2, bestStreak: 2 });
});

test('recordAnswer resets the streak on a wrong answer but keeps the best', () => {
  let stats = createEmptyStats();
  for (const answer of [true, true, true, false, true]) stats = recordAnswer(stats, answer);
  assert.deepEqual(stats, {
    totalQuestions: 5,
    correctAnswers: 4,
    currentStreak: 1,
    bestStreak: 3,
  });
});

test('accuracyPercent rounds and is null with no answers', () => {
  assert.equal(accuracyPercent(createEmptyStats()), null);
  assert.equal(
    accuracyPercent({ ...createEmptyStats(), totalQuestions: 3, correctAnswers: 2 }),
    67
  );
});

test('normalizeStats fills missing or invalid fields with zero', () => {
  assert.deepEqual(normalizeStats(undefined), createEmptyStats());
  assert.deepEqual(normalizeStats({ totalQuestions: 4, bestStreak: 'x', currentStreak: -1 }), {
    totalQuestions: 4,
    correctAnswers: 0,
    currentStreak: 0,
    bestStreak: 0,
  });
});
