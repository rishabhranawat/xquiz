/**
 * Pure answer-checking logic (no DOM), unit-tested in tests/.
 */

import { QUIZ_TYPES } from '../shared/constants.js';

const OPTION_LETTERS = 'abcdefghij';
const MAX_FILL_BLANK_TYPOS = 2;

/**
 * Edit distance between two strings (insertions, deletions, substitutions).
 * @param {string} a
 * @param {string} b
 */
export function levenshteinDistance(a, b) {
  let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    const current = [i];
    for (let j = 1; j <= a.length; j++) {
      current[j] =
        b[i - 1] === a[j - 1]
          ? previous[j - 1]
          : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1;
    }
    previous = current;
  }
  return previous[a.length];
}

/**
 * True if the option at `index` is the correct answer of a choice quiz.
 * Multiple choice answers start with the option letter ("b" or "b) ..."),
 * true/false answers are compared with the option text.
 * @param {{type: string, options: string[] | null, answer: string}} quiz
 * @param {number} index
 */
export function isOptionCorrect(quiz, index) {
  const answer = quiz.answer.toLowerCase();
  if (quiz.type === QUIZ_TYPES.MULTIPLE_CHOICE) return OPTION_LETTERS[index] === answer.charAt(0);
  if (quiz.type === QUIZ_TYPES.TRUE_FALSE) return quiz.options?.[index]?.toLowerCase() === answer;
  return false;
}

/**
 * Lenient fill-in-the-blank check: containment either way, or a couple of typos.
 * An empty response is never correct.
 * @param {string} response What the user typed.
 * @param {string} answer The expected word/phrase.
 */
export function isFillBlankCorrect(response, answer) {
  const given = response.trim().toLowerCase();
  const expected = answer.trim().toLowerCase();
  if (!given) return false;
  return (
    given.includes(expected) ||
    expected.includes(given) ||
    levenshteinDistance(given, expected) <= MAX_FILL_BLANK_TYPOS
  );
}
