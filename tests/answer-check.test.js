import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isFillBlankCorrect,
  isOptionCorrect,
  levenshteinDistance,
} from '../src/sidepanel/answer-check.js';

test('levenshteinDistance', () => {
  assert.equal(levenshteinDistance('kitten', 'sitting'), 3);
  assert.equal(levenshteinDistance('', 'abc'), 3);
  assert.equal(levenshteinDistance('same', 'same'), 0);
});

test('isOptionCorrect for multiple choice uses the answer letter', () => {
  const quiz = { type: 'multiple_choice', options: ['a) x', 'b) y'], answer: 'B' };
  assert.equal(isOptionCorrect(quiz, 0), false);
  assert.equal(isOptionCorrect(quiz, 1), true);
  assert.equal(isOptionCorrect({ ...quiz, answer: 'b) y' }, 1), true);
});

test('isOptionCorrect for true/false compares the option text', () => {
  const quiz = { type: 'true_false', options: ['True', 'False'], answer: 'false' };
  assert.equal(isOptionCorrect(quiz, 0), false);
  assert.equal(isOptionCorrect(quiz, 1), true);
});

test('isFillBlankCorrect is lenient but not empty-friendly', () => {
  assert.equal(isFillBlankCorrect('Paris', 'paris'), true);
  assert.equal(isFillBlankCorrect('the city of paris', 'paris'), true);
  assert.equal(isFillBlankCorrect('par', 'paris'), true);
  assert.equal(isFillBlankCorrect('pariz', 'paris'), true);
  assert.equal(isFillBlankCorrect('london', 'paris'), false);
  assert.equal(isFillBlankCorrect('   ', 'paris'), false);
});
